import { describe, expect, it } from "vitest";

import { validateReviewedHltvPlayerStats } from "@/domain/external-data/reviewed-player-stats";

interface TestBundle {
  capturedAt: string;
  periodEnd: string;
  periodStart: string;
  provider: "HLTV";
  records: Array<{
    career: { maps: number | null; rating: number } | null;
    careerSourceUrl: string | null;
    externalId: string;
    externalSlug: string;
    recent: { maps: number; rating: number } | null;
    recentSourceUrl: string;
  }>;
  version: 1;
}

const validBundle = (): TestBundle => ({
  capturedAt: "2026-08-15T00:00:00.000Z",
  periodEnd: "2026-08-14",
  periodStart: "2026-05-15",
  provider: "HLTV" as const,
  records: [
    {
      career: { maps: 1_200, rating: 1.02 },
      careerSourceUrl: "https://www.hltv.org/stats/players/429/karrigan",
      externalId: "429",
      externalSlug: "karrigan",
      recent: { maps: 46, rating: 0.73 },
      recentSourceUrl:
        "https://www.hltv.org/stats/players/429/karrigan?startDate=2026-05-15&endDate=2026-08-14",
    },
  ],
  version: 1 as const,
});

describe("reviewed HLTV Player stats", () => {
  it("accepts exact official recent and career evidence", () => {
    expect(validateReviewedHltvPlayerStats(validBundle()).records).toHaveLength(1);
  });

  it("accepts an honestly missing career metric", () => {
    const bundle = validBundle();
    bundle.records[0]!.career = null;
    bundle.records[0]!.careerSourceUrl = null;
    expect(validateReviewedHltvPlayerStats(bundle).records[0]?.career).toBeNull();
  });

  it("rejects duplicate identities", () => {
    const bundle = validBundle();
    bundle.records.push(structuredClone(bundle.records[0]!));
    expect(() => validateReviewedHltvPlayerStats(bundle)).toThrow("Duplicate HLTV Player ID");
  });

  it("rejects a recent URL whose identity or period does not match", () => {
    const bundle = validBundle();
    bundle.records[0]!.recentSourceUrl =
      "https://www.hltv.org/stats/players/7998/s1mple?startDate=2026-05-15&endDate=2026-08-14";
    expect(() => validateReviewedHltvPlayerStats(bundle)).toThrow("exact official stats URL");
  });

  it("rejects career data without its separate all-time source", () => {
    const bundle = validBundle();
    bundle.records[0]!.careerSourceUrl = null;
    expect(() => validateReviewedHltvPlayerStats(bundle)).toThrow(
      "both career data and its source",
    );
  });
});
