import { DomainError } from "../error.ts";

export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  if (!value.year || !value.month || !value.day) {
    throw new DomainError("TIME_ZONE_DATE_FAILED", "Could not determine the local usage date");
  }

  return `${value.year}-${value.month}-${value.day}`;
}
