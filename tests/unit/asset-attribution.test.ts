import { describe, expect, it } from "vitest";
import { loadAttributionManifest } from "@/domain/assets/attribution";

describe("local asset attribution", () => {
  it("keeps a versioned and valid attribution manifest", async () => {
    await expect(loadAttributionManifest()).resolves.toEqual({ assets: [], version: 1 });
  });
});
