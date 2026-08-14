import { describe, expect, it } from "vitest";
import { attributionManifestSchema, loadAttributionManifest } from "@/domain/assets/attribution";

describe("local asset attribution", () => {
  it("keeps a versioned and valid attribution manifest", async () => {
    await expect(loadAttributionManifest()).resolves.toEqual({ assets: [], version: 1 });
  });

  it("records owner-accepted provisional assets without claiming a third-party license", () => {
    expect(
      attributionManifestSchema.parse({
        assets: [
          {
            assetPath: "/images/players/example.webp",
            license: "Rights review deferred to Owner",
            notes: "Community-beta source candidate",
            permission: "OWNER_ACCEPTED_PENDING_RIGHTS",
            sourceUrl: "https://example.com/player-image",
          },
        ],
        version: 1,
      }),
    ).toBeDefined();
  });

  it("requires provenance for owner-accepted provisional assets", () => {
    expect(() =>
      attributionManifestSchema.parse({
        assets: [
          {
            assetPath: "/images/teams/example.webp",
            license: "Rights review deferred to Owner",
            notes: null,
            permission: "OWNER_ACCEPTED_PENDING_RIGHTS",
            sourceUrl: null,
          },
        ],
        version: 1,
      }),
    ).toThrow();
  });
});
