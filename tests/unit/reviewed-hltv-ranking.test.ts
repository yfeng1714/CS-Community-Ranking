import reviewedRanking from "../../data/reviewed-sources/hltv-ranking-2026-08-10-top12.json";

import { describe, expect, it } from "vitest";

import { validateReviewedHltvRanking } from "@/domain/external-data/reviewed-ranking";

describe("reviewed HLTV ranking fallback", () => {
  it("requires a complete, identified top 12 with formal starting fives", () => {
    const result = validateReviewedHltvRanking(reviewedRanking);

    expect(result.teams).toHaveLength(12);
    expect(result.teams.map((team) => team.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.teams.every((team) => team.roster.length === 5)).toBe(true);
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
});
