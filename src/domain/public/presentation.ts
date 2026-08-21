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

export type RankingSortDirection = "asc" | "desc";

export interface RankingOrderKey {
  decisions: number;
  nickname: string;
  score: number;
  winRate: number | null;
}

export function compareRankingOrder(left: RankingOrderKey, right: RankingOrderKey): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.winRate !== right.winRate) {
    if (left.winRate === null) return 1;
    if (right.winRate === null) return -1;
    return right.winRate - left.winRate;
  }
  if (left.decisions !== right.decisions) {
    return right.decisions - left.decisions;
  }
  return left.nickname.localeCompare(right.nickname, "en");
}

export function orderRankingRows<T extends RankingOrderKey>(
  rows: readonly T[],
  direction: RankingSortDirection = "desc",
): T[] {
  const sorted = [...rows].sort(compareRankingOrder);
  return direction === "asc" ? sorted.reverse() : sorted;
}

export function dataFreshness(
  capturedAt: Date | null,
  now: Date,
  staleAfterMilliseconds: number = PUBLIC_STATS_STALE_AFTER_MS,
): DataFreshness {
  if (!capturedAt) {
    return "MISSING";
  }
  return now.getTime() - capturedAt.getTime() > staleAfterMilliseconds ? "STALE" : "CURRENT";
}
