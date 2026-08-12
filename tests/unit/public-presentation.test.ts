import { describe, expect, it } from "vitest";

import {
  calculateWinRate,
  dataFreshness,
  PUBLIC_STATS_STALE_AFTER_MS,
  toPublicCount,
  toPublicMetric,
} from "@/domain/public/presentation";
import { DomainError } from "@/domain/error";

describe("public data presentation", () => {
  it("uses a nullable win rate when no counted decision exists", () => {
    expect(calculateWinRate(0, 0)).toBeNull();
    expect(calculateWinRate(3, 1)).toBe(0.75);
  });

  it("marks missing, current, and older-than-48-hour stats explicitly", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    expect(dataFreshness(null, now)).toBe("MISSING");
    expect(dataFreshness(new Date(now.getTime() - PUBLIC_STATS_STALE_AFTER_MS), now)).toBe(
      "CURRENT",
    );
    expect(dataFreshness(new Date(now.getTime() - PUBLIC_STATS_STALE_AFTER_MS - 1), now)).toBe(
      "STALE",
    );
  });

  it("converts database numeric strings and rejects unsafe public counters", () => {
    expect(toPublicMetric("1.237")).toBe(1.237);
    expect(toPublicMetric(undefined)).toBeNull();
    expect(toPublicCount(42n, "votes")).toBe(42);
    expect(() => toPublicCount(BigInt(Number.MAX_SAFE_INTEGER) + 1n, "votes")).toThrow(DomainError);
  });
});
