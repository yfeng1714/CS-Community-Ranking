import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { seedDevelopmentData } from "@/db/seed";
import { getPublicPlayer, getPublicRanking } from "@/domain/public/queries";

import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
  await seedDevelopmentData(database);

  const rows = await database
    .select({ id: schema.players.id, slug: schema.players.slug })
    .from(schema.players);
  const playerIds = new Map(rows.map((row) => [row.slug, row.id]));
  const aceId = playerIds.get("sample-ace");
  const boltId = playerIds.get("sample-bolt");
  if (!aceId || !boltId) throw new Error("Development fixture players are missing");

  await database
    .update(schema.players)
    .set({ hltvProfileUrl: "https://www.hltv.org/player/12345/sample-ace" })
    .where(eq(schema.players.id, aceId));

  await database
    .update(schema.teams)
    .set({ logoPath: "/images/teams/sample-alpha.webp" })
    .where(eq(schema.teams.slug, "sample-alpha"));

  await database
    .update(schema.playerRankings)
    .set({ losses: 0n, score: 2, wins: 2n })
    .where(eq(schema.playerRankings.playerId, aceId));
  await database
    .update(schema.playerRankings)
    .set({ losses: 1n, score: 2, wins: 3n })
    .where(eq(schema.playerRankings.playerId, boltId));
  await database.insert(schema.playerStatSnapshots).values([
    {
      capturedAt: new Date("2026-08-12T10:00:00.000Z"),
      maps: 18,
      metric: "rating_3_0",
      periodEnd: "2026-08-12",
      periodStart: "2026-05-12",
      periodType: "LAST_3_MONTHS",
      playerId: aceId,
      provider: "HLTV",
      sourceUrl: "https://example.invalid/stats/sample-ace",
      value: "1.27",
    },
    {
      capturedAt: new Date("2026-08-12T10:00:00.000Z"),
      metric: "career_rating",
      periodType: "CAREER",
      playerId: aceId,
      provider: "HLTV",
      sourceUrl: "https://example.invalid/stats/sample-ace-career",
      value: "1.14",
    },
    {
      capturedAt: new Date("2026-08-12T10:00:00.000Z"),
      metric: "top20_rank",
      periodEnd: "2023-12-31",
      periodStart: "2023-01-01",
      periodType: "CAREER",
      playerId: aceId,
      provider: "HLTV",
      sourceUrl: "https://example.invalid/player/sample-ace",
      value: "3",
    },
    {
      capturedAt: new Date("2026-08-12T10:00:00.000Z"),
      metric: "top20_rank",
      periodEnd: "2025-12-31",
      periodStart: "2025-01-01",
      periodType: "CAREER",
      playerId: aceId,
      provider: "HLTV",
      sourceUrl: "https://example.invalid/player/sample-ace",
      value: "3",
    },
    {
      capturedAt: new Date("2026-08-12T10:00:00.000Z"),
      metric: "top20_rank",
      periodEnd: "2024-12-31",
      periodStart: "2024-01-01",
      periodType: "CAREER",
      playerId: aceId,
      provider: "HLTV",
      sourceUrl: "https://example.invalid/player/sample-ace",
      value: "18",
    },
    {
      capturedAt: new Date("2026-08-12T11:00:00.000Z"),
      maps: 99,
      metric: "rating_3_0",
      periodEnd: "2026-08-12",
      periodStart: "2026-05-12",
      periodType: "LAST_3_MONTHS",
      playerId: aceId,
      provider: "OTHER",
      sourceUrl: "https://example.invalid/non-hltv-stats/sample-ace",
      value: "9.99",
    },
  ]);
});

afterAll(async () => {
  await dropTestDatabase(testDatabase);
});

describe("Milestone 5 public queries", () => {
  it("publishes competition ranks and breaks equal-score display order by decisions", async () => {
    const ranking = await getPublicRanking(database);

    expect(ranking.edition?.code).toBe("2026");
    expect(ranking.players.map(({ nickname, rank, score }) => ({ nickname, rank, score }))).toEqual(
      [
        { nickname: "Bolt", rank: 1, score: 2 },
        { nickname: "Ace", rank: 1, score: 2 },
        { nickname: "Clutch", rank: 3, score: 0 },
        { nickname: "Drift", rank: 3, score: 0 },
      ],
    );
  });

  it("publishes roster, ranking, recent stats, and an explicit freshness state", async () => {
    const player = await getPublicPlayer(
      database,
      "sample-ace",
      new Date("2026-08-12T12:00:00.000Z"),
    );

    expect(player).toMatchObject({
      careerRating: 1.14,
      freshness: "CURRENT",
      hltvProfileUrl: "https://www.hltv.org/player/12345/sample-ace",
      nickname: "Ace",
      ranking: { rank: 1, score: 2 },
      recentMaps: 18,
      recentRating: 1.27,
      team: "Sample Alpha",
      teamLogoUrl: "/images/teams/sample-alpha.webp",
      teamShortName: "ALPHA",
      top20Peak: { rank: 3, years: [2023, 2025] },
    });
    await expect(getPublicPlayer(database, "not-a-player")).resolves.toBeNull();
  });
});
