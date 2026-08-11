import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema/index.ts";

type Database = NodePgDatabase<typeof schema>;

function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) {
    throw new Error(`Development seed failed to return ${label}`);
  }

  return row;
}

export async function seedDevelopmentData(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    const [adminRow] = await transaction
      .insert(schema.adminUsers)
      .values({
        active: false,
        passwordHash: "disabled-development-seed-account",
        username: "development-seed",
      })
      .onConflictDoUpdate({
        target: schema.adminUsers.username,
        set: {
          active: false,
          passwordHash: "disabled-development-seed-account",
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.adminUsers.id });
    const admin = requireRow(adminRow, "development admin");

    const [editionRow] = await transaction
      .insert(schema.editions)
      .values({
        ballotTtlMinutes: 30,
        code: "2026",
        endsAt: new Date("2027-01-01T00:00:00.000Z"),
        fullWeightBallotsPerDay: 50,
        name: "2026 Development Edition",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        status: "DRAFT",
      })
      .onConflictDoUpdate({
        target: schema.editions.code,
        set: {
          ballotTtlMinutes: 30,
          endsAt: new Date("2027-01-01T00:00:00.000Z"),
          fullWeightBallotsPerDay: 50,
          name: "2026 Development Edition",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.editions.id });
    const edition = requireRow(editionRow, "development Edition");

    const sampleTeams = [
      { name: "Sample Alpha", shortName: "ALPHA", slug: "sample-alpha" },
      { name: "Sample Bravo", shortName: "BRAVO", slug: "sample-bravo" },
    ] as const;

    const teamIds = new Map<string, bigint>();
    for (const team of sampleTeams) {
      const [teamRow] = await transaction
        .insert(schema.teams)
        .values(team)
        .onConflictDoUpdate({
          target: schema.teams.slug,
          set: {
            active: true,
            name: team.name,
            shortName: team.shortName,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.teams.id });
      teamIds.set(team.slug, requireRow(teamRow, `team ${team.slug}`).id);
    }

    const samplePlayers = [
      { nickname: "Ace", slug: "sample-ace", teamSlug: "sample-alpha" },
      { nickname: "Bolt", slug: "sample-bolt", teamSlug: "sample-alpha" },
      { nickname: "Clutch", slug: "sample-clutch", teamSlug: "sample-bravo" },
      { nickname: "Drift", slug: "sample-drift", teamSlug: "sample-bravo" },
    ] as const;

    const playerIds = new Map<string, bigint>();
    for (const player of samplePlayers) {
      const [playerRow] = await transaction
        .insert(schema.players)
        .values({
          nickname: player.nickname,
          professionalStatus: "ACTIVE",
          slug: player.slug,
        })
        .onConflictDoUpdate({
          target: schema.players.slug,
          set: {
            nickname: player.nickname,
            professionalStatus: "ACTIVE",
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.players.id });
      const persistedPlayer = requireRow(playerRow, `player ${player.slug}`);
      playerIds.set(player.slug, persistedPlayer.id);

      const existingRoster = await transaction
        .select({ teamId: schema.rosterMemberships.teamId })
        .from(schema.rosterMemberships)
        .where(
          and(
            eq(schema.rosterMemberships.playerId, persistedPlayer.id),
            isNull(schema.rosterMemberships.endsAt),
          ),
        )
        .limit(1);
      const expectedTeamId = requireRow(teamIds.get(player.teamSlug), `team ${player.teamSlug}`);
      const currentRoster = existingRoster[0];

      if (currentRoster && currentRoster.teamId !== expectedTeamId) {
        throw new Error(`Development player ${player.slug} already has a different current team`);
      }

      if (!currentRoster) {
        await transaction.insert(schema.rosterMemberships).values({
          playerId: persistedPlayer.id,
          source: "development-seed",
          startsAt: "2026-01-01",
          status: "STARTER",
          teamId: expectedTeamId,
        });
      }
    }

    const poolTeamIds = new Map<string, bigint>();
    for (const team of sampleTeams) {
      const teamId = requireRow(teamIds.get(team.slug), `team ${team.slug}`);
      const [poolTeamRow] = await transaction
        .insert(schema.poolTeamEntries)
        .values({
          admissionReason: "Illustrative Milestone 1 development data",
          admissionType: "CORE",
          approvedBy: admin.id,
          editionId: edition.id,
          teamId,
        })
        .onConflictDoUpdate({
          target: [schema.poolTeamEntries.editionId, schema.poolTeamEntries.teamId],
          set: {
            admissionReason: "Illustrative Milestone 1 development data",
            admissionType: "CORE",
            approvedBy: admin.id,
          },
        })
        .returning({ id: schema.poolTeamEntries.id });
      poolTeamIds.set(team.slug, requireRow(poolTeamRow, `pool team ${team.slug}`).id);
    }

    for (const player of samplePlayers) {
      const playerId = requireRow(playerIds.get(player.slug), `player ${player.slug}`);
      const sourceTeamEntryId = requireRow(
        poolTeamIds.get(player.teamSlug),
        `pool team ${player.teamSlug}`,
      );

      await transaction
        .insert(schema.poolPlayerEntries)
        .values({
          admissionReason: "Illustrative Milestone 1 development data",
          admissionType: "CORE",
          approvedBy: admin.id,
          editionId: edition.id,
          playerId,
          sourceTeamEntryId,
        })
        .onConflictDoUpdate({
          target: [schema.poolPlayerEntries.editionId, schema.poolPlayerEntries.playerId],
          set: {
            admissionReason: "Illustrative Milestone 1 development data",
            admissionType: "CORE",
            approvedBy: admin.id,
            sourceTeamEntryId,
          },
        });

      await transaction
        .insert(schema.playerRankings)
        .values({ editionId: edition.id, playerId })
        .onConflictDoNothing();
    }

    const [eventRow] = await transaction
      .insert(schema.events)
      .values({
        endsAt: "2026-02-07",
        isMajor: false,
        isT1Whitelisted: false,
        name: "Sample Invitational",
        slug: "sample-invitational-2026",
        startsAt: "2026-02-01",
        whitelistReason: "NONE",
      })
      .onConflictDoUpdate({
        target: schema.events.slug,
        set: {
          endsAt: "2026-02-07",
          name: "Sample Invitational",
          startsAt: "2026-02-01",
        },
      })
      .returning({ id: schema.events.id });
    const event = requireRow(eventRow, "sample event");

    for (const [position, team] of sampleTeams.entries()) {
      const teamId = requireRow(teamIds.get(team.slug), `team ${team.slug}`);
      await transaction
        .insert(schema.eventTeamResults)
        .values({
          eventId: event.id,
          placementFrom: position + 1,
          placementTo: position + 1,
          teamId,
        })
        .onConflictDoUpdate({
          target: [schema.eventTeamResults.eventId, schema.eventTeamResults.teamId],
          set: {
            placementFrom: position + 1,
            placementTo: position + 1,
          },
        });
    }
  });
}
