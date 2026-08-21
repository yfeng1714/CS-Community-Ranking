import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { validateEventMvpBundle } from "@/domain/event-mvp/bundle";
import { compareEventMvpPlayers, withUniqueEventMvpRanks } from "@/domain/event-mvp/service";

describe("event MVP bundle and ordering", () => {
  it("accepts the reviewed EWC top-10 snapshot", async () => {
    const bundle = validateEventMvpBundle(
      JSON.parse(await readFile("data/reviewed-sources/hltv-ewc-2026-top10.json", "utf8")),
    );
    expect(bundle.records).toHaveLength(10);
    expect(bundle.records[0]?.slug).toBe("m0nesy");
    expect(bundle.records[9]?.slug).toBe("jame");
    expect(bundle.records.map((record) => record.slug)).not.toContain("dumau");
  });

  it("orders by votes, then event rating, then maps, then nickname", () => {
    const rows = [
      { eventRating: 1.25, maps: 5, nickname: "Bolt", votes: 2 },
      { eventRating: 1.25, maps: 9, nickname: "Ace", votes: 2 },
      { eventRating: 1.2, maps: 8, nickname: "Clutch", votes: 1 },
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
        { eventRating: 1.25, maps: 10, nickname: "Ace", votes: 3 },
        { eventRating: 1.2, maps: 8, nickname: "Bolt", votes: 3 },
      ].sort(compareEventMvpPlayers),
    );
    expect(ranked.map((row) => row.rank)).toEqual([1, 2]);
  });
});
