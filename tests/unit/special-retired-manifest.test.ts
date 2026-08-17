import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadSpecialRetiredManifest,
  summarizeSpecialRetiredManifest,
} from "@/domain/pool/special-retired-manifest";

const manifestFile = path.resolve("data/review-manual/special-retired-2026-08-17.json");

describe("Special retired admission manifest", () => {
  it("validates the Owner-approved 2026-08-17 retired Special set", async () => {
    const manifest = await loadSpecialRetiredManifest(manifestFile);
    expect(summarizeSpecialRetiredManifest(manifest)).toEqual({
      editionCode: "2026",
      observedAt: "2026-08-17",
      players: ["machinewjq", "advent"],
      reviewStatus: "OWNER_APPROVED",
    });
    expect(manifest.players.map((player) => player.careerRating)).toEqual([0.78, 0.85]);
    expect(manifest.players[0]?.photoPath).toBe("/images/players/MachineWJQ.webp");
  });
});
