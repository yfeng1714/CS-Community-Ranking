import { describe, expect, it } from "vitest";
import canonicalManifest from "../../data/canonical/2026-beta.json";

import { canonicalManifestSchema } from "@/domain/canonical/manifest";
import {
  createReviewedHltvPlayerStatsTemplate,
  mergeCapturedRecentStats,
  validateReviewedHltvPlayerStats,
} from "@/domain/external-data/reviewed-player-stats";

interface TestBundle {
  capturedAt: string;
  periodEnd: string;
  periodStart: string;
  provider: "HLTV";
  records: Array<{
    adr: number | null;
    career: { maps: number | null; rating: number } | null;
    careerSourceUrl: string | null;
    countryCode: string | null;
    externalId: string;
    externalSlug: string;
    firepower: number | null;
    majorsWon: number | null;
    mvpCount: number | null;
    recent: {
      adr: number | null;
      firepower: number | null;
      maps: number;
      rating: number;
    } | null;
    recentSourceUrl: string;
    top20Placements: Array<{ rank: number; year: number }>;
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
      adr: null,
      career: { maps: 1_200, rating: 1.02 },
      careerSourceUrl: "https://www.hltv.org/stats/players/429/karrigan",
      countryCode: "DK",
      externalId: "429",
      externalSlug: "karrigan",
      firepower: 2,
      majorsWon: 2,
      mvpCount: 32,
      recent: { adr: null, firepower: 2, maps: 46, rating: 0.73 },
      recentSourceUrl:
        "https://www.hltv.org/stats/players/429/karrigan?startDate=2026-05-15&endDate=2026-08-14",
      top20Placements: [{ rank: 20, year: 2014 }],
    },
  ],
  version: 1 as const,
});

describe("reviewed HLTV Player stats", () => {
  it("creates an exact 70-identity empty review template from the canonical manifest", () => {
    const template = createReviewedHltvPlayerStatsTemplate(
      canonicalManifestSchema.parse(canonicalManifest),
      {
        capturedAt: "2026-08-15T00:00:00.000Z",
        periodEnd: "2026-08-14",
        periodStart: "2026-05-15",
      },
    );

    expect(template.records).toHaveLength(70);
    expect(new Set(template.records.map((record) => record.externalId)).size).toBe(70);
    expect(template.records[0]).toMatchObject({
      externalId: "429",
      externalSlug: "karrigan",
      recent: null,
      recentSourceUrl:
        "https://www.hltv.org/stats/players/429/karrigan?startDate=2026-05-15&endDate=2026-08-14",
    });
  });

  it("rejects invalid template dates before writing operational evidence", () => {
    expect(() =>
      createReviewedHltvPlayerStatsTemplate(canonicalManifestSchema.parse(canonicalManifest), {
        capturedAt: "not-a-timestamp",
        periodEnd: "2026-05-15",
        periodStart: "2026-08-14",
      }),
    ).toThrow();
  });

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

  it("fills observed recent metrics onto the exact 70-identity template", () => {
    const template = createReviewedHltvPlayerStatsTemplate(
      canonicalManifestSchema.parse(canonicalManifest),
      {
        capturedAt: "2026-08-16T03:00:00.000Z",
        periodEnd: "2026-08-16",
        periodStart: "2026-05-16",
      },
    );
    const merged = mergeCapturedRecentStats(
      template,
      new Map([
        [
          "429",
          {
            adr: null,
            careerRating: null,
            countryCode: "DK",
            firepower: 2,
            majorsWon: 2,
            maps: 43,
            mvpCount: 32,
            rating: 0.75,
            top20Placements: [],
          },
        ],
        [
          "11893",
          {
            adr: null,
            careerRating: null,
            countryCode: "FR",
            firepower: 98,
            majorsWon: 1,
            maps: 40,
            mvpCount: 21,
            rating: 1.32,
            top20Placements: [
              { rank: 1, year: 2025 },
              { rank: 3, year: 2024 },
              { rank: 1, year: 2023 },
            ],
          },
        ],
      ]),
    );
    expect(merged.records).toHaveLength(70);
    expect(merged.records.find((record) => record.externalId === "429")).toMatchObject({
      countryCode: "DK",
      firepower: 2,
      majorsWon: 2,
      mvpCount: 32,
      recent: { adr: null, firepower: 2, maps: 43, rating: 0.75 },
      top20Placements: [],
    });
    expect(merged.records.find((record) => record.externalId === "11893")).toMatchObject({
      countryCode: "FR",
      recent: { adr: null, firepower: 98, maps: 40, rating: 1.32 },
      top20Placements: [
        { rank: 1, year: 2025 },
        { rank: 3, year: 2024 },
        { rank: 1, year: 2023 },
      ],
    });
    expect(merged.records.filter((record) => record.recent === null)).toHaveLength(68);
    expect(merged.records.every((record) => record.career === null)).toBe(true);
    expect(validateReviewedHltvPlayerStats(merged).records).toHaveLength(70);
  });

  it("rejects a capture for an identity that is not in the template", () => {
    const template = createReviewedHltvPlayerStatsTemplate(
      canonicalManifestSchema.parse(canonicalManifest),
      {
        capturedAt: "2026-08-16T03:00:00.000Z",
        periodEnd: "2026-08-16",
        periodStart: "2026-05-16",
      },
    );
    expect(() =>
      mergeCapturedRecentStats(
        template,
        new Map([
          [
            "7998",
            {
              adr: null,
              careerRating: null,
              countryCode: null,
              firepower: 10,
              majorsWon: 0,
              maps: 10,
              mvpCount: 0,
              rating: 1.1,
              top20Placements: [],
            },
          ],
        ]),
      ),
    ).toThrow("not in the reviewed template");
  });
});
