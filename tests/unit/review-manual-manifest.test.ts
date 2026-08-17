import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertReviewManualManifestApproved,
  loadReviewManualManifest,
  reviewManualManifestSchema,
  summarizeReviewManualManifest,
} from "@/domain/pool/review-manual-manifest";

const manifestFile = path.resolve("data/review-manual/2026-08-17.json");

describe("Review Manual admission manifest", () => {
  it("validates the Owner-approved 2026-08-17 Review Manual set", async () => {
    const manifest = await loadReviewManualManifest(manifestFile);

    expect(summarizeReviewManualManifest(manifest)).toEqual({
      editionCode: "2026",
      observedAt: "2026-08-17",
      players: 20,
      reviewStatus: "OWNER_APPROVED",
      teams: ["bcgame", "100-thieves", "tyloo", "lynn-vision"],
    });
    expect(() => assertReviewManualManifestApproved(manifest)).not.toThrow();
    expect(manifest.teams.every((team) => team.players.length === 5)).toBe(true);
    expect(manifest.teams.every((team) => team.admissionReason.length >= 3)).toBe(true);
    expect(manifest.teams.every((team) => team.logoPath === null)).toBe(true);
  });

  it("rejects a player profile URL that does not match its HLTV identity", async () => {
    const manifest = await loadReviewManualManifest(manifestFile);
    const mismatched = structuredClone(manifest);
    mismatched.teams[0]!.players[0]!.hltvProfileUrl = "https://www.hltv.org/player/1/wrong";
    expect(reviewManualManifestSchema.safeParse(mismatched).success).toBe(false);
  });
});
