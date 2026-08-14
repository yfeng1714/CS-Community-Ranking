import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertCanonicalManifestApproved,
  canonicalManifestSchema,
  loadCanonicalManifest,
  summarizeCanonicalManifest,
} from "@/domain/canonical/manifest";

const manifestFile = path.resolve("data/canonical/2026-beta.json");

describe("M10 canonical manifest", () => {
  it("validates the Owner-approved real-data input and exposes its review boundary", async () => {
    const manifest = await loadCanonicalManifest(manifestFile);

    expect(summarizeCanonicalManifest(manifest)).toEqual({
      editionCode: "2026",
      observedAt: "2026-08-14",
      players: 70,
      reviewStatus: "OWNER_APPROVED",
      teams: 14,
    });
    expect(() => assertCanonicalManifestApproved(manifest)).not.toThrow();
    expect(manifest.teams.every((team) => team.players.length === 5)).toBe(true);
    expect(
      manifest.teams.every(
        (team) =>
          team.logoPath === null && team.players.every((player) => player.photoPath === null),
      ),
    ).toBe(true);
  });

  it("rejects duplicate identities and a profile URL that does not match its HLTV ID", async () => {
    const manifest = await loadCanonicalManifest(manifestFile);
    const duplicateIdentity = structuredClone(manifest);
    duplicateIdentity.teams[1]!.players[0]!.hltvIdentity.externalId =
      duplicateIdentity.teams[0]!.players[0]!.hltvIdentity.externalId;
    expect(canonicalManifestSchema.safeParse(duplicateIdentity).success).toBe(false);

    const mismatchedProfile = structuredClone(manifest);
    mismatchedProfile.teams[0]!.players[0]!.hltvProfileUrl =
      "https://www.hltv.org/player/11893/zywoo";
    expect(canonicalManifestSchema.safeParse(mismatchedProfile).success).toBe(false);
  });
});
