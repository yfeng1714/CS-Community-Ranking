import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { validateEventMvpBundle } from "@/domain/event-mvp/bundle";
import { compareEventMvpPlayers, withUniqueEventMvpRanks } from "@/domain/event-mvp/service";

describe("event MVP bundle and ordering", () => {
  it("accepts the reviewed EWC candidate snapshot, including Top 10 dropouts", async () => {
    const bundle = validateEventMvpBundle(
      JSON.parse(await readFile("data/reviewed-sources/hltv-ewc-2026-candidates.json", "utf8")),
    );
    const slugs = bundle.records.map((record) => record.slug);
    expect(bundle.records).toHaveLength(13);
    expect(slugs.slice(0, 10)).toEqual([
      "m0nesy",
      "donk",
      "xkacpersky",
      "zywoo",
      "kscerato",
      "xfl0ud",
      "tenzy",
      "try",
      "jame",
      "nqz",
    ]);
    expect(slugs).toContain("kyousuke");
    expect(slugs).toContain("n1ssim");
    expect(slugs).toContain("niko");
    expect(slugs).not.toContain("dumau");
    expect(bundle.records.every((record) => record.teamStanding)).toBe(true);
  });

  it("orders by votes, then event rating, then team standing, then maps, then nickname", () => {
    const rows = [
      { eventRating: 1.27, maps: 10, nickname: "Bolt", teamStanding: "GROUP" as const, votes: 2 },
      {
        eventRating: 1.27,
        maps: 5,
        nickname: "Ace",
        teamStanding: "SEMIFINAL" as const,
        votes: 2,
      },
      {
        eventRating: 1.2,
        maps: 8,
        nickname: "Clutch",
        teamStanding: "QUARTERFINAL" as const,
        votes: 1,
      },
    ];
    expect([...rows].sort(compareEventMvpPlayers).map((row) => row.nickname)).toEqual([
      "Ace",
      "Bolt",
      "Clutch",
    ]);
  });

  it("assigns unique sequential ranks even when vote counts match", () => {
    const ranked = withUniqueEventMvpRanks(
      [
        {
          eventRating: 1.25,
          maps: 10,
          nickname: "Ace",
          teamStanding: "SEMIFINAL" as const,
          votes: 3,
        },
        {
          eventRating: 1.2,
          maps: 8,
          nickname: "Bolt",
          teamStanding: "GROUP" as const,
          votes: 3,
        },
      ].sort(compareEventMvpPlayers),
    );
    expect(ranked.map((row) => row.rank)).toEqual([1, 2]);
  });
});
