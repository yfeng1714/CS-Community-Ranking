import { eq } from "drizzle-orm";

import {
  adminUsers,
  editions,
  playerExternalIdentities,
  players,
  rosterMemberships,
  teamExternalIdentities,
  teams,
} from "@/db/schema";
import type { AppDatabase } from "@/domain/database";
import { createEdition } from "@/domain/editions/service";
import { DomainError, requireDomainValue, requireNonBlank } from "@/domain/error";
import {
  upsertPlayerExternalIdentity,
  upsertTeamExternalIdentity,
} from "@/domain/external-identities/service";
import { createPlayer } from "@/domain/players/service";
import { addRosterMembership } from "@/domain/rosters/service";
import { createTeam } from "@/domain/teams/service";

import { assertCanonicalManifestApproved, type CanonicalManifest } from "./manifest.ts";

export interface CanonicalBootstrapResult {
  editionId: string;
  players: number;
  rosters: number;
  teams: number;
}

export async function bootstrapCanonicalManifest(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    manifest: CanonicalManifest;
    reason: string;
  },
): Promise<CanonicalBootstrapResult> {
  assertCanonicalManifestApproved(input.manifest);
  const reason = requireNonBlank(input.reason, "Canonical bootstrap reason");

  return database.transaction(async (transaction) => {
    const nestedDatabase = transaction as unknown as AppDatabase;
    const [actor] = await transaction
      .select({ active: adminUsers.active, id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.id, input.actorAdminUserId))
      .for("update")
      .limit(1);
    const currentActor = requireDomainValue(
      actor,
      "ADMIN_NOT_FOUND",
      `Admin ${input.actorAdminUserId} not found`,
    );
    if (!currentActor.active) {
      throw new DomainError("ADMIN_INACTIVE", "Canonical bootstrap actor must be active");
    }

    const guardedTables = [
      ["Edition", editions],
      ["Team", teams],
      ["Player", players],
      ["Roster", rosterMemberships],
      ["Team external identity", teamExternalIdentities],
      ["Player external identity", playerExternalIdentities],
    ] as const;
    for (const [label, table] of guardedTables) {
      const existing = await transaction.select().from(table).limit(1);
      if (existing.length > 0) {
        throw new DomainError(
          "CANONICAL_BOOTSTRAP_REQUIRES_EMPTY_DATABASE",
          `Canonical bootstrap requires empty product tables; ${label} already has data`,
        );
      }
    }

    const edition = await createEdition(nestedDatabase, {
      actorAdminUserId: currentActor.id,
      ballotTtlMinutes: input.manifest.edition.ballotTtlMinutes,
      code: input.manifest.edition.code,
      endsAt: new Date(input.manifest.edition.endsAt),
      fullWeightBallotsPerDay: input.manifest.edition.fullWeightBallotsPerDay,
      name: input.manifest.edition.name,
      reason,
      startsAt: new Date(input.manifest.edition.startsAt),
    });

    let playerCount = 0;
    let rosterCount = 0;
    for (const teamInput of input.manifest.teams) {
      const team = await createTeam(nestedDatabase, {
        actorAdminUserId: currentActor.id,
        countryCode: teamInput.countryCode,
        logoPath: teamInput.logoPath,
        name: teamInput.name,
        reason,
        shortName: teamInput.shortName,
        slug: teamInput.slug,
      });
      await upsertTeamExternalIdentity(nestedDatabase, {
        actorAdminUserId: currentActor.id,
        externalId: teamInput.hltvIdentity.externalId,
        externalSlug: teamInput.hltvIdentity.externalSlug,
        provider: "HLTV",
        reason,
        sourceUrl: teamInput.hltvIdentity.sourceUrl,
        teamId: team.id,
      });

      for (const playerInput of teamInput.players) {
        const player = await createPlayer(nestedDatabase, {
          actorAdminUserId: currentActor.id,
          countryCode: playerInput.countryCode,
          hltvProfileUrl: playerInput.hltvProfileUrl,
          nickname: playerInput.nickname,
          photoPath: playerInput.photoPath,
          professionalStatus: "ACTIVE",
          realName: playerInput.realName,
          reason,
          slug: playerInput.slug,
        });
        await upsertPlayerExternalIdentity(nestedDatabase, {
          actorAdminUserId: currentActor.id,
          externalId: playerInput.hltvIdentity.externalId,
          externalSlug: playerInput.hltvIdentity.externalSlug,
          playerId: player.id,
          provider: "HLTV",
          reason,
          sourceUrl: playerInput.hltvIdentity.sourceUrl,
        });
        await addRosterMembership(nestedDatabase, {
          actorAdminUserId: currentActor.id,
          playerId: player.id,
          reason,
          source: `Owner-reviewed canonical observation ${input.manifest.observedAt}; historical join date not asserted`,
          startsAt: input.manifest.observedAt,
          status: "STARTER",
          teamId: team.id,
        });
        playerCount += 1;
        rosterCount += 1;
      }
    }

    return {
      editionId: edition.id.toString(),
      players: playerCount,
      rosters: rosterCount,
      teams: input.manifest.teams.length,
    };
  });
}
