import reviewedRanking from "../../data/reviewed-sources/hltv-ranking-2026-08-10-top12.json";

import { describe, expect, it } from "vitest";

import {
  reviewedHltvRankingCoverage,
  reviewedHltvRankingParserVersion,
  validateReviewedHltvRanking,
} from "@/domain/external-data/reviewed-ranking";

describe("reviewed HLTV ranking fallback", () => {
  it("requires a complete, identified top 12 with formal starting fives", () => {
    const result = validateReviewedHltvRanking(reviewedRanking);

    expect(result.teams).toHaveLength(12);
    expect(result.teams.map((team) => team.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.teams.every((team) => team.roster.length === 5)).toBe(true);
    expect(reviewedHltvRankingCoverage(result)).toBe(12);
    expect(reviewedHltvRankingParserVersion(result)).toBe("hltv-reviewed-top12-json-v1");
  });

  it("accepts a complete reviewed top 20 as a separately labeled source", () => {
    const top20 = structuredClone(reviewedRanking);
    for (let rank = 13; rank <= 20; rank += 1) {
      top20.teams.push({
        externalId: String(20_000 + rank),
        externalSlug: `fixture-team-${rank}`,
        name: `Fixture Team ${rank}`,
        points: null,
        rank,
        roster: Array.from({ length: 5 }, (_, index) => `fixture-${rank}-${index + 1}`),
      });
    }

    const result = validateReviewedHltvRanking(top20);
    expect(reviewedHltvRankingCoverage(result)).toBe(20);
    expect(reviewedHltvRankingParserVersion(result)).toBe("hltv-reviewed-top20-json-v1");
  });

  it("fails closed when a rank or identity is duplicated", () => {
    const duplicateRank = structuredClone(reviewedRanking);
    duplicateRank.teams[1]!.rank = 1;
    expect(() => validateReviewedHltvRanking(duplicateRank)).toThrowError(
      expect.objectContaining({ code: "REVIEWED_HLTV_TOP12_INCOMPLETE" }),
    );

    const duplicateIdentity = structuredClone(reviewedRanking);
    duplicateIdentity.teams[1]!.externalId = duplicateIdentity.teams[0]!.externalId;
    expect(() => validateReviewedHltvRanking(duplicateIdentity)).toThrowError(
      expect.objectContaining({ code: "REVIEWED_HLTV_IDENTITY_DUPLICATE" }),
    );
  });

  it("rejects unsupported partial coverage, duplicate starters, and date drift", () => {
    const partial = structuredClone(reviewedRanking);
    partial.teams.push({
      externalId: "20013",
      externalSlug: "fixture-team-13",
      name: "Fixture Team 13",
      points: null,
      rank: 13,
      roster: ["a", "b", "c", "d", "e"],
    });
    expect(() => validateReviewedHltvRanking(partial)).toThrowError(
      expect.objectContaining({ code: "REVIEWED_HLTV_COVERAGE_UNSUPPORTED" }),
    );

    const duplicateStarter = structuredClone(reviewedRanking);
    duplicateStarter.teams[0]!.roster[1] = duplicateStarter.teams[0]!.roster[0]!;
    expect(() => validateReviewedHltvRanking(duplicateStarter)).toThrowError(
      expect.objectContaining({ code: "REVIEWED_HLTV_TEAM_INCOMPLETE" }),
    );

    const dateDrift = structuredClone(reviewedRanking);
    dateDrift.publishedAt = "2026-08-11T00:00:00.000Z";
    expect(() => validateReviewedHltvRanking(dateDrift)).toThrowError(
      expect.objectContaining({ code: "REVIEWED_HLTV_DATE_MISMATCH" }),
    );
  });
});
