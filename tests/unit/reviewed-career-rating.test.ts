import path from "node:path";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { validateReviewedCareerRatingBundle } from "@/domain/external-data/reviewed-career-rating";

const manifestFile = path.resolve("data/review-manual/career-ratings-2026-08-17.json");

describe("reviewed career Rating overrides", () => {
  it("accepts the Owner-reviewed MachineWJQ career Rating", async () => {
    const bundle = validateReviewedCareerRatingBundle(
      JSON.parse(await readFile(manifestFile, "utf8")),
    );
    expect(bundle.records).toEqual([
      {
        rating: 0.78,
        slug: "machinewjq",
        sourceUrl: "https://www.hltv.org/player/16149/machinewjq",
      },
      {
        rating: 0.85,
        slug: "advent",
        sourceUrl: "https://www.hltv.org/player/8600/advent",
      },
    ]);
  });

  it("rejects a duplicate slug", () => {
    expect(() =>
      validateReviewedCareerRatingBundle({
        capturedAt: "2026-08-17T14:20:00.000Z",
        notes: ["test"],
        provider: "HLTV",
        records: [
          {
            rating: 0.78,
            slug: "machinewjq",
            sourceUrl: "https://www.hltv.org/player/16149/machinewjq",
          },
          {
            rating: 0.8,
            slug: "machinewjq",
            sourceUrl: "https://www.hltv.org/player/16149/machinewjq",
          },
        ],
        version: 1,
      }),
    ).toThrow("Duplicate career Rating slug");
  });
});
