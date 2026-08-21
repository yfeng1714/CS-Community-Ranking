import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { validateEventMvpBundle } from "@/domain/event-mvp/bundle";
import { compareEventMvpPlayers } from "@/domain/event-mvp/service";

describe("event MVP bundle and ordering", () => {
  it("accepts the reviewed EWC top-15 snapshot", async () => {
    const bundle = validateEventMvpBundle(
      JSON.parse(await readFile("data/reviewed-sources/hltv-ewc-2026-top15.json", "utf8")),
    );
    expect(bundle.records).toHaveLength(15);
    expect(bundle.records[0]?.slug).toBe("m0nesy");
    expect(bundle.records[14]?.slug).toBe("huasopeek");
  });

  it("orders by votes, then event rating, then nickname", () => {
    const rows = [
      { eventRating: 1.4, nickname: "Bolt", votes: 2 },
      { eventRating: 1.65, nickname: "Ace", votes: 2 },
      { eventRating: 1.2, nickname: "Clutch", votes: 1 },
    ];
    expect([...rows].sort(compareEventMvpPlayers).map((row) => row.nickname)).toEqual([
      "Ace",
      "Bolt",
      "Clutch",
    ]);
  });
});
