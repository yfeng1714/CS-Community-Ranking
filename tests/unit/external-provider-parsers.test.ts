import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  parseHltvPlayerStatsHtml,
  parseHltvTeamRankingHtml,
} from "@/domain/external-data/providers/hltv";
import { parseValveVrsMarkdown } from "@/domain/external-data/providers/valve-vrs";

const fixture = (name: string) =>
  readFile(path.join(process.cwd(), "tests", "fixtures", name), "utf8");

describe("Milestone 7 provider parsers", () => {
  it("normalizes the official Valve Markdown standings format", async () => {
    const parsed = parseValveVrsMarkdown(
      await fixture("valve-vrs/standings-global.md"),
      "https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/invitation/2026/standings_global_2026_08_03.md",
    );
    expect(parsed.publishedAt).toBe("2026-08-03T00:00:00.000Z");
    expect(parsed.teams).toHaveLength(3);
    expect(parsed.teams[0]).toMatchObject({
      name: "Sample Alpha",
      points: 2011,
      rank: 1,
      roster: ["Ace", "Bolt", "Cedar", "Delta", "Echo"],
    });
  });

  it("rejects non-official VRS source locations", async () => {
    const body = await fixture("valve-vrs/standings-global.md");
    expect(() => parseValveVrsMarkdown(body, "https://example.com/vrs.md")).toThrow(
      "ValveSoftware",
    );
  });

  it("normalizes only the narrow HLTV team ranking fields", async () => {
    const parsed = parseHltvTeamRankingHtml(
      await fixture("hltv/team-ranking.html"),
      "https://www.hltv.org/ranking/teams/2026/august/3",
      new Date("2026-08-03T00:00:00.000Z"),
    );
    expect(parsed.teams).toEqual([
      {
        externalId: "1001",
        externalSlug: "sample-alpha",
        name: "Sample Alpha",
        points: 1000,
        rank: 1,
        roster: ["Ace", "Bolt", "Cedar", "Delta", "Echo"],
      },
      {
        externalId: "1002",
        externalSlug: "sample-bravo",
        name: "Sample Bravo",
        points: 850,
        rank: 2,
        roster: ["Fox", "Gale", "Halo", "Ion", "Jade"],
      },
    ]);
  });

  it("normalizes the owned HLTV Rating fields from saved HTML", async () => {
    const parsed = parseHltvPlayerStatsHtml({
      body: await fixture("hltv/player-stats.html"),
      externalId: "42",
      periodEnd: "2026-08-03",
      periodStart: "2026-05-03",
      sourceUrl: "https://www.hltv.org/stats/players/42/sample-player",
    });
    expect(parsed).toMatchObject({
      career: { maps: 912, rating: 1.17 },
      recent: { maps: 42, rating: 1.24 },
    });
  });

  it("fails closed when the HLTV structure drifts", () => {
    expect(() =>
      parseHltvTeamRankingHtml(
        "<html>changed</html>",
        "https://www.hltv.org/ranking/teams/2026/august/3",
        new Date(),
      ),
    ).toThrow("expected format");
  });
});
