import { DomainError } from "../error.ts";

export type DataFreshness = "CURRENT" | "MISSING" | "STALE";

export const PUBLIC_STATS_STALE_AFTER_MS = 48 * 60 * 60 * 1_000;

export function toPublicCount(value: bigint, label: string): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) {
    throw new DomainError("PUBLIC_COUNTER_OVERFLOW", `${label} exceeds the public numeric range`);
  }
  return converted;
}

export function toPublicMetric(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
}

export function calculateWinRate(wins: number, losses: number): number | null {
  const decisions = wins + losses;
  return decisions === 0 ? null : wins / decisions;
}

export function dataFreshness(capturedAt: Date | null, now: Date): DataFreshness {
  if (!capturedAt) {
    return "MISSING";
  }
  return now.getTime() - capturedAt.getTime() > PUBLIC_STATS_STALE_AFTER_MS ? "STALE" : "CURRENT";
}
