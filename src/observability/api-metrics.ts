import { apiRequestMetrics } from "@/db/schema";
import type { AppDatabase } from "@/domain/database";

const SAFE_ERROR_CODE = /^[A-Z0-9_]{1,64}$/;

export async function recordApiMetric(
  database: AppDatabase,
  input: {
    errorCode?: string | null;
    latencyMs: number;
    route: string;
    statusCode: number;
    visitorId?: bigint | null;
  },
): Promise<void> {
  await database.insert(apiRequestMetrics).values({
    errorCode:
      input.errorCode && SAFE_ERROR_CODE.test(input.errorCode) ? input.errorCode : undefined,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    route: input.route,
    statusCode: input.statusCode,
    visitorId: input.visitorId,
  });
}

export async function errorCodeFromResponse(response: Response): Promise<string | null> {
  if (response.status < 400) return null;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const error = body.error;
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" && SAFE_ERROR_CODE.test(error.code) ? error.code : null;
}
