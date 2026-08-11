export interface PostgreSqlErrorLike {
  cause?: unknown;
  code?: unknown;
}

const RETRYABLE_TRANSACTION_CODES = new Set(["40001", "40P01"]);

export function findPostgreSqlErrorCode(error: unknown): string | undefined {
  let current = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    const candidate = current as PostgreSqlErrorLike;
    if (typeof candidate.code === "string") {
      return candidate.code;
    }
    current = candidate.cause;
  }

  return undefined;
}

export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    pause?: (milliseconds: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const pause =
    options.pause ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt >= maxAttempts ||
        !RETRYABLE_TRANSACTION_CODES.has(findPostgreSqlErrorCode(error) ?? "")
      ) {
        throw error;
      }

      await pause(Math.floor(10 * 2 ** (attempt - 1) + random() * 20));
    }
  }
}
