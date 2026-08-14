import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { snapshotDailyRanking } from "@/domain/external-data/daily-ranking";
import { syncValveVrs } from "@/domain/external-data/jobs";
import { buildCandidatePoolDraft } from "@/domain/external-data/pool-draft";
import {
  approveRankingSourceSnapshot,
  writeRankingSourceSnapshot,
} from "@/domain/external-data/snapshots";
import { sourceChecksum } from "@/domain/external-data/checksum";
import { parseHltvTeamRankingHtml } from "@/domain/external-data/providers/hltv";
import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;
let adminId: bigint;
let editionId: bigint;

const fixture = (name: string) =>
  readFile(path.join(process.cwd(), "tests", "fixtures", name), "utf8");

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
  const [admin] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "test", username: "m7-reviewer" })
    .returning();
  const [edition] = await database
    .insert(schema.editions)
    .values({
      code: "2026",
      endsAt: new Date("2027-01-01T00:00:00Z"),
      name: "M7",
      startsAt: new Date("2026-01-01T00:00:00Z"),
      status: "DRAFT",
    })
    .returning();
  if (!admin || !edition) throw new Error("Failed to seed M7 integration data");
  adminId = admin.id;
  editionId = edition.id;
});

afterAll(async () => dropTestDatabase(testDatabase));

describe("Milestone 7 external data jobs", () => {
  it("records VRS sync lifecycle, writes immutable snapshots, and deduplicates checksum", async () => {
    const body = await fixture("valve-vrs/standings-global.md");
    const sourceUrl =
      "https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/invitation/2026/standings_global_2026_08_03.md";
    const first = await syncValveVrs(database, {
      body,
      capturedAt: new Date("2026-08-04T00:00:00Z"),
      sourceUrl,
    });
    const second = await syncValveVrs(database, {
      body,
      capturedAt: new Date("2026-08-05T00:00:00Z"),
      sourceUrl,
    });
    expect(second.snapshotId).toBe(first.snapshotId);
    await expect(
      database
        .select()
        .from(schema.rankingSourceSnapshots)
        .where(eq(schema.rankingSourceSnapshots.provider, "VALVE_VRS")),
    ).resolves.toHaveLength(1);
    const runs = await database
      .select()
      .from(schema.syncRuns)
      .where(eq(schema.syncRuns.jobName, "sync-vrs"));
    expect(runs.map((run) => [run.status, run.recordsChanged])).toEqual([
      ["SUCCEEDED", 1],
      ["SUCCEEDED", 0],
    ]);
  });

  it("records parser failure without deleting the last usable snapshot", async () => {
    const sourceUrl =
      "https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/invitation/2026/standings_global_2026_08_03.md";
    await expect(
      syncValveVrs(database, { body: "format changed", sourceUrl }),
    ).rejects.toMatchObject({ code: "VRS_PUBLISHED_DATE_MISSING" });
    const [failed] = await database
      .select()
      .from(schema.syncRuns)
      .where(eq(schema.syncRuns.status, "FAILED"));
    expect(failed?.errorSummary).toContain("standings date");
    await expect(
      database
        .select()
        .from(schema.rankingSourceSnapshots)
        .where(eq(schema.rankingSourceSnapshots.provider, "VALVE_VRS")),
    ).resolves.toHaveLength(1);
  });

  it("requires approved sources and creates review-only Pool proposals", async () => {
    const [team] = await database
      .insert(schema.teams)
      .values({ name: "Sample Alpha", slug: "sample-alpha" })
      .returning();
    if (!team) throw new Error("Failed to create M7 team");
    await database.insert(schema.teamExternalIdentities).values({
      externalId: "1001",
      externalSlug: "sample-alpha",
      lastVerifiedAt: new Date(),
      provider: "HLTV",
      sourceUrl: "https://www.hltv.org/team/1001/sample-alpha",
      teamId: team.id,
    });
    for (const nickname of ["Ace", "Bolt", "Cedar", "Delta", "Echo"]) {
      const [player] = await database
        .insert(schema.players)
        .values({ nickname, professionalStatus: "ACTIVE", slug: nickname.toLowerCase() })
        .returning();
      if (player)
        await database.insert(schema.rosterMemberships).values({
          playerId: player.id,
          startsAt: "2026-01-01",
          status: "STARTER",
          teamId: team.id,
        });
    }

    const vrs = await database
      .select()
      .from(schema.rankingSourceSnapshots)
      .where(eq(schema.rankingSourceSnapshots.provider, "VALVE_VRS"));
    await approveRankingSourceSnapshot(database, {
      actorAdminUserId: adminId,
      reason: "Fixture verified",
      snapshotId: vrs[0]!.id,
    });
    const hltvBody = await fixture("hltv/team-ranking.html");
    const hltvSnapshot = parseHltvTeamRankingHtml(
      hltvBody,
      "https://www.hltv.org/ranking/teams/2026/august/3",
      new Date("2026-08-03T00:00:00Z"),
    );
    const storedHltv = await writeRankingSourceSnapshot(database, {
      capturedAt: new Date("2026-08-04T00:00:00Z"),
      checksum: sourceChecksum(hltvBody),
      parserVersion: "test",
      provider: "HLTV",
      snapshot: hltvSnapshot,
    });
    await approveRankingSourceSnapshot(database, {
      actorAdminUserId: adminId,
      reason: "Fixture verified",
      snapshotId: storedHltv.id,
    });

    const report = await buildCandidatePoolDraft(database, {
      editionCode: "2026",
      maxSourceAgeDays: 14,
      now: new Date("2026-08-10T00:00:00Z"),
    });
    expect(report.proposed).toContain("Sample Alpha");
    expect(report.warnings).toContainEqual({
      codes: ["TOP20_TEAM_NOT_IMPORTED_NO_EVENT_EVIDENCE"],
      provider: "VALVE_VRS",
      sourceTeam: "Sample Charlie",
    });
    const [pending] = await database
      .select()
      .from(schema.pendingImportChanges)
      .where(
        and(
          eq(schema.pendingImportChanges.editionId, editionId),
          eq(schema.pendingImportChanges.targetExternalKey, `team:${team.id}`),
        ),
      );
    expect(pending).toMatchObject({ changeType: "POOL_TEAM", status: "PENDING" });
    await expect(
      database
        .select()
        .from(schema.poolTeamEntries)
        .where(eq(schema.poolTeamEntries.editionId, editionId)),
    ).resolves.toHaveLength(0);
  });

  it("upserts tied daily ranking snapshots idempotently", async () => {
    const players = await database.select().from(schema.players).limit(2);
    for (const player of players)
      await database
        .insert(schema.playerRankings)
        .values({ editionId, playerId: player.id, score: 2, wins: 3n, losses: 1n })
        .onConflictDoNothing();
    await snapshotDailyRanking(database, { editionCode: "2026", snapshotDate: "2026-08-12" });
    await snapshotDailyRanking(database, { editionCode: "2026", snapshotDate: "2026-08-12" });
    const rows = await database
      .select()
      .from(schema.dailyRankingSnapshots)
      .where(eq(schema.dailyRankingSnapshots.editionId, editionId));
    expect(rows).toHaveLength(players.length);
    expect(new Set(rows.map((row) => row.rank))).toEqual(new Set([1]));
  });
});
