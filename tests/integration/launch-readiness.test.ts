import { and, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { checkLaunchReadiness } from "@/domain/launch/readiness";
import { ActivePoolCache } from "@/domain/pool/active-pool-cache";
import { CandidatePoolService } from "@/domain/pool/service";
import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
});

afterAll(async () => dropTestDatabase(testDatabase));

describe("Milestone 10 launch readiness", () => {
  it("passes an auditable zeroed draft and fails closed on unresolved imports and roster drift", async () => {
    const now = new Date("2035-08-14T00:00:00Z");
    const [admin] = await database
      .insert(schema.adminUsers)
      .values({ passwordHash: "test-only", username: "launch-owner" })
      .returning();
    const [edition] = await database
      .insert(schema.editions)
      .values({
        code: "2035",
        endsAt: new Date("2036-01-01T00:00:00Z"),
        name: "2035 Launch Fixture",
        startsAt: new Date("2035-01-01T00:00:00Z"),
        status: "DRAFT",
      })
      .returning();
    const [team] = await database
      .insert(schema.teams)
      .values({ name: "Launch Team", slug: "launch-team" })
      .returning();
    if (!admin || !edition || !team) throw new Error("Failed to create launch fixtures");

    await database.insert(schema.teamExternalIdentities).values({
      externalId: "launch-team-2035",
      lastVerifiedAt: now,
      provider: "HLTV",
      sourceUrl: "https://www.hltv.org/team/2035/launch-team",
      teamId: team.id,
    });

    const playerIds: bigint[] = [];
    for (let index = 1; index <= 5; index += 1) {
      const [player] = await database
        .insert(schema.players)
        .values({
          nickname: `Launch ${index}`,
          professionalStatus: "ACTIVE",
          slug: `launch-${index}`,
        })
        .returning();
      if (!player) throw new Error("Failed to create launch Player fixture");
      playerIds.push(player.id);
      await database.insert(schema.playerExternalIdentities).values({
        externalId: `launch-player-${index}`,
        lastVerifiedAt: now,
        playerId: player.id,
        provider: "HLTV",
        sourceUrl: `https://www.hltv.org/player/${index}/launch-${index}`,
      });
      await database.insert(schema.rosterMemberships).values({
        playerId: player.id,
        startsAt: "2035-01-01",
        status: "STARTER",
        teamId: team.id,
      });
    }

    const sourceFreshness = {
      HLTV: "2035-08-10T00:00:00.000Z",
      VALVE_VRS: "2035-08-11T00:00:00.000Z",
    };
    for (const [provider, publishedAt] of Object.entries(sourceFreshness) as Array<
      ["HLTV" | "VALVE_VRS", string]
    >) {
      await database.insert(schema.rankingSourceSnapshots).values({
        approvedAt: now,
        approvedBy: admin.id,
        capturedAt: new Date(publishedAt),
        normalizedData: { publishedAt, sourceUrl: "https://example.com", teams: [] },
        parserVersion: "launch-test-v1",
        provider,
        publishedAt: new Date(publishedAt),
        rawChecksum: `launch-${provider.toLowerCase()}`,
      });
    }
    const [draftRun] = await database
      .insert(schema.syncRuns)
      .values({
        finishedAt: now,
        jobName: "build-pool-draft",
        metadata: { editionCode: edition.code, sourceFreshness },
        provider: "INTERNAL",
        sourceFreshnessAt: new Date(sourceFreshness.HLTV),
        startedAt: new Date("2035-08-14T00:00:00Z"),
        status: "SUCCEEDED",
      })
      .returning();
    if (!draftRun) throw new Error("Failed to create Pool draft fixture");

    const pool = new CandidatePoolService(database, new ActivePoolCache(60_000));
    await pool.admitManualTeam({
      actorAdminUserId: admin.id,
      editionId: edition.id,
      reason: "Owner-approved M10 launch fixture",
      teamId: team.id,
    });

    const ready = await checkLaunchReadiness(database, {
      editionCode: edition.code,
      expectedRiskMode: "observe",
      now,
      sourceMaxAgeDays: 14,
    });
    expect(ready.blocking).toBe(false);
    expect(ready.pool).toMatchObject({
      activePairingPlayers: 5,
      admissionCounts: { CORE: 0, REVIEW_AUTO: 0, REVIEW_MANUAL: 5, SPECIAL: 0 },
      pairCount: "10",
      players: 5,
      teams: 1,
    });
    expect(ready.checks.filter((item) => item.status === "WARN").map((item) => item.code)).toEqual([
      "PLACEHOLDER_ASSETS_REMAIN",
      "PLAYER_STATS_MISSING",
    ]);

    const [pending] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "POOL_TEAM",
        editionId: edition.id,
        proposedData: { version: 1 },
        syncRunId: draftRun.id,
        targetExternalKey: "team:unresolved",
      })
      .returning();
    if (!pending) throw new Error("Failed to create pending import fixture");
    const withPendingImport = await checkLaunchReadiness(database, {
      editionCode: edition.code,
      expectedRiskMode: "observe",
      now,
      sourceMaxAgeDays: 14,
    });
    expect(withPendingImport.checks).toContainEqual(
      expect.objectContaining({ code: "IMPORT_CONFLICTS_RESOLVED", status: "BLOCK" }),
    );

    await database
      .update(schema.pendingImportChanges)
      .set({ status: "SUPERSEDED" })
      .where(eq(schema.pendingImportChanges.id, pending.id));
    await database
      .update(schema.rosterMemberships)
      .set({ endsAt: "2035-08-13" })
      .where(
        and(
          eq(schema.rosterMemberships.playerId, playerIds[0]!),
          eq(schema.rosterMemberships.teamId, team.id),
        ),
      );
    const withRosterDrift = await checkLaunchReadiness(database, {
      editionCode: edition.code,
      expectedRiskMode: "observe",
      now,
      sourceMaxAgeDays: 14,
    });
    expect(withRosterDrift.checks).toContainEqual(
      expect.objectContaining({ code: "ROSTER_PROVENANCE_RESOLVED", status: "BLOCK" }),
    );

    await database
      .update(schema.rosterMemberships)
      .set({ endsAt: null })
      .where(
        and(
          eq(schema.rosterMemberships.playerId, playerIds[0]!),
          eq(schema.rosterMemberships.teamId, team.id),
        ),
      );
    await database.insert(schema.poolChangeLogs).values({
      action: "UNRELATED_TEST_LOG",
      actorAdminUserId: admin.id,
      editionId: edition.id,
      reason: "Prove audit coverage requires the matching admission action and target",
      targetId: "unrelated",
      targetType: "POOL_PLAYER",
    });
    const [playerEntry] = await database
      .select({ id: schema.poolPlayerEntries.id })
      .from(schema.poolPlayerEntries)
      .where(
        and(
          eq(schema.poolPlayerEntries.editionId, edition.id),
          eq(schema.poolPlayerEntries.playerId, playerIds[0]!),
        ),
      );
    if (!playerEntry) throw new Error("Failed to load Pool Player audit fixture");
    await database
      .update(schema.poolChangeLogs)
      .set({ targetId: "wrong-target" })
      .where(
        and(
          eq(schema.poolChangeLogs.action, "ADMIT_TEAM_PLAYER"),
          eq(schema.poolChangeLogs.editionId, edition.id),
          eq(schema.poolChangeLogs.targetId, playerEntry.id.toString()),
        ),
      );
    const exactAuditCoverage = await checkLaunchReadiness(database, {
      editionCode: edition.code,
      expectedRiskMode: "observe",
      now,
      sourceMaxAgeDays: 14,
    });
    expect(exactAuditCoverage.checks).toContainEqual(
      expect.objectContaining({ code: "POOL_AUDIT_COVERAGE", status: "BLOCK" }),
    );
  });
});
