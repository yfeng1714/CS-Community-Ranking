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

function padUtc(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatUtcIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${padUtc(date.getUTCMonth() + 1)}-${padUtc(date.getUTCDate())}`;
}

export function localIsoDate(date = new Date()): string {
  return `${date.getFullYear()}-${padUtc(date.getMonth() + 1)}-${padUtc(date.getDate())}`;
}

export function shiftIsoDateByMonths(value: string, months: number, field = "Date"): string {
  const iso = requireIsoDate(value, field);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const targetMonthIndex = month - 1 + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  return formatUtcIsoDate(
    new Date(Date.UTC(year, targetMonthIndex, Math.min(day, lastDayOfTargetMonth))),
  );
}
