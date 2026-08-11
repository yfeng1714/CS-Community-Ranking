import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { and, asc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { createEdition, transitionEdition } from "@/domain/editions/service";
import { createEvent, recordEventTeamResult, setEventWhitelist } from "@/domain/events/service";
import { createPlayer, updatePlayer } from "@/domain/players/service";
import { ActivePoolCache } from "@/domain/pool/active-pool-cache";
import { CandidatePoolService } from "@/domain/pool/service";
import { addRosterMembership, endRosterMembership } from "@/domain/rosters/service";
import { createTeam, updateTeam } from "@/domain/teams/service";
import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

const execFileAsync = promisify(execFile);

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;

async function createActor(username: string): Promise<bigint> {
  const [actor] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "integration-test-disabled-hash", username })
    .returning({ id: schema.adminUsers.id });

  if (!actor) {
    throw new Error("Failed to create integration-test actor");
  }

  return actor.id;
}

async function insertTeamWithFiveStarters(suffix: string) {
  const [team] = await database
    .insert(schema.teams)
    .values({ name: `Team ${suffix}`, slug: `team-${suffix}` })
    .returning();
  if (!team) {
    throw new Error("Failed to create team fixture");
  }

  const playerIds: bigint[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const [player] = await database
      .insert(schema.players)
      .values({
        nickname: `${suffix}-${index}`,
        professionalStatus: "ACTIVE",
        slug: `player-${suffix}-${index}`,
      })
      .returning();
    if (!player) {
      throw new Error("Failed to create player fixture");
    }
    playerIds.push(player.id);
    await database.insert(schema.rosterMemberships).values({
      playerId: player.id,
      startsAt: "2031-01-01",
      status: "STARTER",
      teamId: team.id,
    });
  }

  return { playerIds, team };
}

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
});

afterAll(async () => {
  await dropTestDatabase(testDatabase);
});

describe("Milestone 2 Candidate Pool domain", () => {
  it("manages Edition, Team, Player, Roster, and Event records with audit history", async () => {
    const actorAdminUserId = await createActor("domain-service-actor");
    const edition = await createEdition(database, {
      actorAdminUserId,
      ballotTtlMinutes: 30,
      code: "2030",
      endsAt: new Date("2031-01-01T00:00:00Z"),
      fullWeightBallotsPerDay: 50,
      name: "2030 Integration Edition",
      reason: "Exercise the Edition service",
      startsAt: new Date("2030-01-01T00:00:00Z"),
    });
    const team = await createTeam(database, {
      actorAdminUserId,
      name: "Domain Team",
      reason: "Exercise the Team service",
      slug: "domain-team",
    });
    const player = await createPlayer(database, {
      actorAdminUserId,
      nickname: "Domain Player",
      reason: "Exercise the Player service",
      slug: "domain-player",
    });
    const membership = await addRosterMembership(database, {
      actorAdminUserId,
      playerId: player.id,
      reason: "Assign a formal starter",
      startsAt: "2030-01-01",
      status: "STARTER",
      teamId: team.id,
    });

    await expect(
      addRosterMembership(database, {
        actorAdminUserId,
        playerId: player.id,
        reason: "Attempt conflicting current membership",
        startsAt: "2030-02-01",
        status: "BENCH",
        teamId: team.id,
      }),
    ).rejects.toMatchObject({ code: "CURRENT_ROSTER_CONFLICT" });

    await endRosterMembership(database, {
      actorAdminUserId,
      endsAt: "2030-05-31",
      membershipId: membership.id,
      reason: "Close the previous membership explicitly",
    });
    await updateTeam(database, {
      actorAdminUserId,
      reason: "Add a display abbreviation",
      shortName: "DT",
      teamId: team.id,
    });
    await updatePlayer(database, {
      actorAdminUserId,
      countryCode: "CN",
      playerId: player.id,
      reason: "Add profile context",
    });

    const event = await createEvent(database, {
      actorAdminUserId,
      endsAt: "2030-06-21",
      name: "Domain Major",
      reason: "Exercise the Event service",
      slug: "domain-major-2030",
      startsAt: "2030-06-01",
    });
    await setEventWhitelist(database, {
      actorAdminUserId,
      enabled: true,
      eventId: event.id,
      isMajor: true,
      reason: "Confirmed Major events are automatically T1",
      whitelistReason: "MAJOR",
    });
    await expect(
      setEventWhitelist(database, {
        actorAdminUserId,
        enabled: false,
        eventId: event.id,
        isMajor: false,
        reason: "Attempt to rewrite confirmed historical eligibility",
        whitelistReason: "NONE",
      }),
    ).rejects.toMatchObject({ code: "EVENT_WHITELIST_IMMUTABLE" });
    await recordEventTeamResult(database, {
      actorAdminUserId,
      eventId: event.id,
      placementFrom: 5,
      placementTo: 8,
      reason: "Record a Major Top 8 result",
      teamId: team.id,
    });

    await transitionEdition(database, {
      actorAdminUserId,
      editionId: edition.id,
      reason: "Open the integration Edition",
      status: "ACTIVE",
    });
    await transitionEdition(database, {
      actorAdminUserId,
      editionId: edition.id,
      reason: "Freeze the integration Edition",
      status: "FROZEN",
    });
    const archived = await transitionEdition(database, {
      actorAdminUserId,
      editionId: edition.id,
      reason: "Archive the integration Edition",
      status: "ARCHIVED",
    });

    expect(archived.status).toBe("ARCHIVED");
    const auditRows = await database
      .select({ action: schema.adminAuditLogs.action })
      .from(schema.adminAuditLogs)
      .where(eq(schema.adminAuditLogs.actorAdminUserId, actorAdminUserId));
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "CREATE_EDITION",
        "CREATE_TEAM",
        "CREATE_PLAYER",
        "ADD_ROSTER_MEMBERSHIP",
        "END_ROSTER_MEMBERSHIP",
        "SET_EVENT_WHITELIST",
        "CREATE_EVENT_RESULT",
        "TRANSITION_EDITION",
      ]),
    );
  });

  it("admits automatic and manual teams, initializes zero rankings, and invalidates the cache", async () => {
    const actorAdminUserId = await createActor("pool-service-actor");
    const [edition] = await database
      .insert(schema.editions)
      .values({
        code: "2031",
        endsAt: new Date("2032-01-01T00:00:00Z"),
        name: "2031 Pool Edition",
        startsAt: new Date("2031-01-01T00:00:00Z"),
        status: "DRAFT",
      })
      .returning();
    if (!edition) {
      throw new Error("Failed to create pool Edition fixture");
    }
    const automatic = await insertTeamWithFiveStarters("automatic");
    const manual = await insertTeamWithFiveStarters("manual");
    const service = new CandidatePoolService(database, new ActivePoolCache(60_000));

    await expect(service.getActivePlayerIds(edition.id)).resolves.toEqual([]);
    const automaticResult = await service.admitAutomaticTeam({
      actorAdminUserId,
      editionId: edition.id,
      evidence: { editionYear: 2031, eventResults: [], hltvRank: 12 },
      reason: "Apply the approved automatic rule evaluation",
      teamId: automatic.team.id,
    });
    expect(automaticResult.admittedPlayerIds).toEqual(automatic.playerIds);
    await expect(service.getActivePlayerIds(edition.id)).resolves.toEqual(automatic.playerIds);

    await service.admitManualTeam({
      actorAdminUserId,
      editionId: edition.id,
      reason: "Public regional representation reason",
      teamId: manual.team.id,
    });
    const activePlayerIds = await service.getActivePlayerIds(edition.id);
    expect(activePlayerIds).toHaveLength(10);

    const poolEntries = await database
      .select({
        admissionType: schema.poolPlayerEntries.admissionType,
        pairingEnabled: schema.poolPlayerEntries.pairingEnabled,
        playerId: schema.poolPlayerEntries.playerId,
      })
      .from(schema.poolPlayerEntries)
      .where(eq(schema.poolPlayerEntries.editionId, edition.id))
      .orderBy(asc(schema.poolPlayerEntries.playerId));
    const rankings = await database
      .select()
      .from(schema.playerRankings)
      .where(eq(schema.playerRankings.editionId, edition.id));

    expect(new Set(poolEntries.map((entry) => entry.admissionType))).toEqual(
      new Set(["CORE", "REVIEW_MANUAL"]),
    );
    expect(poolEntries.every((entry) => entry.pairingEnabled)).toBe(true);
    expect(activePlayerIds).toEqual(poolEntries.map((entry) => entry.playerId));
    expect(rankings).toHaveLength(10);
    expect(rankings.every((ranking) => ranking.score === 0)).toBe(true);

    const poolLogs = await database
      .select()
      .from(schema.poolChangeLogs)
      .where(eq(schema.poolChangeLogs.editionId, edition.id));
    expect(poolLogs).toHaveLength(12);
  });

  it("adds and disables a Special player through CLI without deleting history", async () => {
    const actorAdminUserId = await createActor("pool-cli-actor");
    const [edition] = await database
      .insert(schema.editions)
      .values({
        code: "2032",
        endsAt: new Date("2033-01-01T00:00:00Z"),
        name: "2032 CLI Edition",
        startsAt: new Date("2032-01-01T00:00:00Z"),
        status: "DRAFT",
      })
      .returning();
    if (!edition) {
      throw new Error("Failed to create CLI Edition fixture");
    }

    const environment = {
      ...process.env,
      ACTIVE_POOL_CACHE_TTL_SECONDS: "60",
      DATABASE_URL: testDatabase.connectionString,
    };
    const addResult = await execFileAsync(
      process.execPath,
      [
        "scripts/pool-add-player.ts",
        "--actor",
        "pool-cli-actor",
        "--edition",
        "2032",
        "--nickname",
        "CLI Candidate",
        "--reason",
        "Approved individual Special inclusion",
        "--slug",
        "cli-candidate",
      ],
      { cwd: process.cwd(), env: environment },
    );
    expect(JSON.parse(addResult.stdout)).toMatchObject({ status: "admitted" });

    const [player] = await database
      .select()
      .from(schema.players)
      .where(eq(schema.players.slug, "cli-candidate"));
    if (!player) {
      throw new Error("CLI did not create the player");
    }
    const [entryBeforeDisable] = await database
      .select()
      .from(schema.poolPlayerEntries)
      .where(
        and(
          eq(schema.poolPlayerEntries.editionId, edition.id),
          eq(schema.poolPlayerEntries.playerId, player.id),
        ),
      );
    expect(entryBeforeDisable).toMatchObject({
      admissionType: "SPECIAL",
      pairingEnabled: true,
      sourceTeamEntryId: null,
    });

    const disableResult = await execFileAsync(
      process.execPath,
      [
        "scripts/pool-disable-player.ts",
        "--actor",
        "pool-cli-actor",
        "--edition",
        "2032",
        "--player",
        "cli-candidate",
        "--reason",
        "Player is no longer professionally active",
      ],
      { cwd: process.cwd(), env: environment },
    );
    expect(JSON.parse(disableResult.stdout)).toMatchObject({
      changed: true,
      status: "pairing-disabled",
    });

    const [entryAfterDisable] = await database
      .select()
      .from(schema.poolPlayerEntries)
      .where(eq(schema.poolPlayerEntries.id, entryBeforeDisable!.id));
    const [ranking] = await database
      .select()
      .from(schema.playerRankings)
      .where(
        and(
          eq(schema.playerRankings.editionId, edition.id),
          eq(schema.playerRankings.playerId, player.id),
        ),
      );
    const service = new CandidatePoolService(database, new ActivePoolCache(60_000));

    expect(entryAfterDisable).toMatchObject({
      admissionType: "SPECIAL",
      pairingEnabled: false,
      pairingDisabledReason: "Player is no longer professionally active",
    });
    expect(ranking).toMatchObject({ score: 0, wins: 0n, losses: 0n, skips: 0n });
    await expect(service.getActivePlayerIds(edition.id)).resolves.toEqual([]);

    const pairingLog = await database
      .select()
      .from(schema.poolChangeLogs)
      .where(
        and(
          eq(schema.poolChangeLogs.editionId, edition.id),
          eq(schema.poolChangeLogs.action, "DISABLE_PAIRING"),
        ),
      );
    expect(pairingLog).toHaveLength(1);
    expect(actorAdminUserId).toBeGreaterThan(0n);
  });
});
