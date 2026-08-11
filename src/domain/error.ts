export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DomainError";
  }
}

export function requireDomainValue<T>(
  value: T | null | undefined,
  code: string,
  message: string,
): T {
  if (value === null || value === undefined) {
    throw new DomainError(code, message);
  }

  return value;
}

export function requireNonBlank(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainError("INVALID_INPUT", `${field} must not be blank`);
  }

  return normalized;
}
