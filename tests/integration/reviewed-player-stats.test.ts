import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import {
  importReviewedHltvPlayerStats,
  validateReviewedHltvPlayerStats,
} from "@/domain/external-data/reviewed-player-stats";
import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;
let adminId: bigint;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
  const [admin] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "test", username: "stats-reviewer" })
    .returning({ id: schema.adminUsers.id });
  const [player] = await database
    .insert(schema.players)
    .values({ nickname: "karrigan", professionalStatus: "ACTIVE", slug: "karrigan" })
    .returning({ id: schema.players.id });
  if (!admin || !player) throw new Error("Failed to seed reviewed stats integration data");
  adminId = admin.id;
  await database.insert(schema.playerExternalIdentities).values({
    externalId: "429",
    externalSlug: "karrigan",
    lastVerifiedAt: new Date("2026-08-15T00:00:00Z"),
    playerId: player.id,
    provider: "HLTV",
    sourceUrl: "https://www.hltv.org/player/429/karrigan",
  });
});

afterAll(async () => dropTestDatabase(testDatabase));

describe("reviewed HLTV Player stats import", () => {
  const bundle = validateReviewedHltvPlayerStats({
    capturedAt: "2026-08-15T00:00:00.000Z",
    periodEnd: "2026-08-14",
    periodStart: "2026-05-15",
    provider: "HLTV",
    records: [
      {
        adr: null,
        career: null,
        careerSourceUrl: null,
        countryCode: "DK",
        externalId: "429",
        externalSlug: "karrigan",
        firepower: 2,
        majorsWon: 2,
        mvpCount: 32,
        recent: { adr: null, firepower: 2, maps: 46, rating: 0.73 },
        recentSourceUrl:
          "https://www.hltv.org/stats/players/429/karrigan?startDate=2026-05-15&endDate=2026-08-14",
        top20Placements: [
          { rank: 20, year: 2014 },
          { rank: 19, year: 2012 },
        ],
      },
    ],
    version: 1,
  });

  it("writes reviewed metrics and one Admin audit atomically", async () => {
    const result = await importReviewedHltvPlayerStats(database, {
      actorAdminUserId: adminId,
      bundle,
      checksum: "fixture-checksum",
      reason: "Reviewed official HLTV page",
    });
    expect(result).toMatchObject({
      careerSnapshots: 0,
      countryUpdates: 1,
      firepowerSnapshots: 1,
      majorsWonSnapshots: 1,
      mvpCountSnapshots: 1,
      playersReviewed: 1,
      recentSnapshots: 1,
      top20RankSnapshots: 2,
      updatedCountryCodes: [{ countryCode: "DK", externalId: "429" }],
    });

    const rows = await database.select().from(schema.playerStatSnapshots);
    expect(rows).toHaveLength(6);
    expect(rows.find((row) => row.metric === "rating_3_0")).toMatchObject({
      maps: 46,
      value: "0.73",
    });
    expect(rows.find((row) => row.metric === "firepower")).toMatchObject({ value: "2" });
    expect(rows.find((row) => row.metric === "majors_won")).toMatchObject({ value: "2" });
    expect(rows.find((row) => row.metric === "mvp_count")).toMatchObject({ value: "32" });
    expect(
      rows
        .filter((row) => row.metric === "top20_rank")
        .map((row) => ({ periodStart: row.periodStart, value: row.value }))
        .sort((left, right) => (left.periodStart ?? "").localeCompare(right.periodStart ?? "")),
    ).toEqual([
      { periodStart: "2012-01-01", value: "19" },
      { periodStart: "2014-01-01", value: "20" },
    ]);
    const [player] = await database.select().from(schema.players);
    expect(player?.countryCode).toBe("DK");
    const audits = await database
      .select()
      .from(schema.adminAuditLogs)
      .where(eq(schema.adminAuditLogs.action, "IMPORT_REVIEWED_HLTV_PLAYER_STATS"));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.targetId).toBe("fixture-checksum");
  });

  it("refuses a duplicate capture timestamp", async () => {
    await expect(
      importReviewedHltvPlayerStats(database, {
        actorAdminUserId: adminId,
        bundle,
        checksum: "second-checksum",
        reason: "Attempt duplicate import",
      }),
    ).rejects.toMatchObject({ code: "REVIEWED_HLTV_STATS_ALREADY_IMPORTED" });
  });
});
