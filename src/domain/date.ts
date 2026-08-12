import { DomainError } from "./error.ts";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function requireIsoDate(value: string, field: string): string {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new DomainError("INVALID_DATE", `${field} must use a valid YYYY-MM-DD date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isExactDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  if (!isExactDate) {
    throw new DomainError("INVALID_DATE", `${field} must use a valid YYYY-MM-DD date`);
  }

  return value;
}
