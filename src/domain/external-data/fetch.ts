import { DomainError } from "../error.ts";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

interface CircuitState {
  failures: number;
  openUntil: number;
}

const circuits = new Map<string, CircuitState>();

export interface FetchTextOptions {
  allowedContentTypes: readonly string[];
  delayMs?: number;
  fetchImplementation?: typeof fetch;
  maxAttempts?: number;
  now?: () => number;
  timeoutMs?: number;
  url: string;
  userAgent: string;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function fetchProviderText(options: FetchTextOptions): Promise<string> {
  const url = new URL(options.url);
  if (url.protocol !== "https:") {
    throw new DomainError("PROVIDER_URL_INSECURE", "Provider URLs must use HTTPS");
  }

  const now = options.now ?? Date.now;
  const circuit = circuits.get(url.host) ?? { failures: 0, openUntil: 0 };
  if (circuit.openUntil > now()) {
    throw new DomainError("PROVIDER_CIRCUIT_OPEN", `Provider circuit is open for ${url.host}`);
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const attempts = options.maxAttempts ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if ((options.delayMs ?? 0) > 0) await wait(options.delayMs!);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetchImplementation(url, {
        headers: {
          accept: options.allowedContentTypes.join(", "),
          "user-agent": options.userAgent,
        },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new DomainError("PROVIDER_HTTP_ERROR", `Provider returned HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!options.allowedContentTypes.some((value) => contentType.includes(value))) {
        throw new DomainError(
          "PROVIDER_CONTENT_TYPE_INVALID",
          `Provider returned unsupported content type ${contentType || "unknown"}`,
        );
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        throw new DomainError("PROVIDER_RESPONSE_TOO_LARGE", "Provider response exceeded 5 MiB");
      }
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
        throw new DomainError("PROVIDER_RESPONSE_TOO_LARGE", "Provider response exceeded 5 MiB");
      }
      circuits.delete(url.host);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(250 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }

  const failures = circuit.failures + 1;
  circuits.set(url.host, {
    failures,
    openUntil: failures >= 3 ? now() + 15 * 60 * 1_000 : 0,
  });
  throw lastError instanceof Error
    ? lastError
    : new DomainError("PROVIDER_FETCH_FAILED", "Provider request failed");
}

export function clearProviderCircuitsForTests(): void {
  circuits.clear();
}
