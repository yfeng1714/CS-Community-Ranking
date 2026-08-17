import { describe, expect, it } from "vitest";
import {
  assetRegistrySchema,
  attributionManifestSchema,
  loadAssetRegistry,
} from "@/domain/assets/attribution";

describe("local asset attribution", () => {
  it("keeps a versioned and valid attribution manifest", async () => {
    const manifest = await loadAssetRegistry();

    expect(manifest.version).toBe(1);
    expect(manifest.assets).toHaveLength(85);
    expect(
      manifest.assets.filter((asset) => asset.assetPath.startsWith("/images/teams/")),
    ).toHaveLength(14);
    expect(
      manifest.assets.filter((asset) => asset.assetPath.startsWith("/images/players/")),
    ).toHaveLength(71);
    expect(
      manifest.assets.filter((asset) => asset.permission === "OWNER_ACCEPTED_PENDING_RIGHTS"),
    ).toHaveLength(84);
    expect(
      manifest.assets.find((asset) => asset.assetPath === "/images/players/MachineWJQ.webp"),
    ).toEqual({
      assetPath: "/images/players/MachineWJQ.webp",
      permission: "OWNER_PROVIDED",
    });
    expect(assetRegistrySchema.parse(manifest)).toEqual(manifest);
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
