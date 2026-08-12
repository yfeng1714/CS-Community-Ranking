import { and, eq } from "drizzle-orm";

import {
  playerExternalIdentities,
  players,
  teamExternalIdentities,
  teams,
} from "../../db/schema/index.ts";
import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";

export type ExternalProvider = "HLTV" | "LIQUIPEDIA" | "PANDASCORE" | "BO3" | "OTHER";

interface IdentityInput {
  actorAdminUserId: bigint;
  externalId: string;
  externalSlug?: string | null | undefined;
  provider: ExternalProvider;
  reason: string;
  sourceUrl: string;
}

function normalizedIdentity(input: IdentityInput) {
  const sourceUrl = requireNonBlank(input.sourceUrl, "External identity source URL");
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new DomainError("INVALID_SOURCE_URL", "External identity source must be a valid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new DomainError("INVALID_SOURCE_URL", "External identity source must use HTTP or HTTPS");
  }

  return {
    externalId: requireNonBlank(input.externalId, "External identity ID"),
    externalSlug: input.externalSlug?.trim() || null,
    lastVerifiedAt: new Date(),
    reason: requireNonBlank(input.reason, "External identity change reason"),
    sourceUrl: parsed.toString(),
  };
}

export async function upsertPlayerExternalIdentity(
  database: AppDatabase,
  input: IdentityInput & { playerId: bigint },
) {
  const value = normalizedIdentity(input);
  return database.transaction(async (transaction) => {
    const [player] = await transaction
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, input.playerId))
      .limit(1);
    requireDomainValue(player, "PLAYER_NOT_FOUND", `Player ${input.playerId} not found`);

    const [conflict] = await transaction
      .select({ playerId: playerExternalIdentities.playerId })
      .from(playerExternalIdentities)
      .where(
        and(
          eq(playerExternalIdentities.provider, input.provider),
          eq(playerExternalIdentities.externalId, value.externalId),
        ),
      )
      .limit(1);
    if (conflict && conflict.playerId !== input.playerId) {
      throw new DomainError(
        "EXTERNAL_IDENTITY_CONFLICT",
        "That provider ID is already assigned to another Player",
      );
    }

    const [before] = await transaction
      .select()
      .from(playerExternalIdentities)
      .where(
        and(
          eq(playerExternalIdentities.playerId, input.playerId),
          eq(playerExternalIdentities.provider, input.provider),
        ),
      )
      .for("update")
      .limit(1);
    const [after] = await transaction
      .insert(playerExternalIdentities)
      .values({
        externalId: value.externalId,
        externalSlug: value.externalSlug,
        lastVerifiedAt: value.lastVerifiedAt,
        playerId: input.playerId,
        provider: input.provider,
        sourceUrl: value.sourceUrl,
      })
      .onConflictDoUpdate({
        target: [playerExternalIdentities.playerId, playerExternalIdentities.provider],
        set: {
          externalId: value.externalId,
          externalSlug: value.externalSlug,
          lastVerifiedAt: value.lastVerifiedAt,
          sourceUrl: value.sourceUrl,
        },
      })
      .returning();
    const saved = requireDomainValue(
      after,
      "EXTERNAL_IDENTITY_UPDATE_FAILED",
      "Player external identity write returned no row",
    );

    await writeAdminAudit(transaction, {
      action: before ? "UPDATE_PLAYER_EXTERNAL_IDENTITY" : "CREATE_PLAYER_EXTERNAL_IDENTITY",
      actorAdminUserId: input.actorAdminUserId,
      after: saved,
      before: before ?? null,
      reason: value.reason,
      targetId: `${input.playerId}:${input.provider}`,
      targetType: "PLAYER_EXTERNAL_IDENTITY",
    });
    return saved;
  });
}

export async function upsertTeamExternalIdentity(
  database: AppDatabase,
  input: IdentityInput & { teamId: bigint },
) {
  const value = normalizedIdentity(input);
  return database.transaction(async (transaction) => {
    const [team] = await transaction
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .limit(1);
    requireDomainValue(team, "TEAM_NOT_FOUND", `Team ${input.teamId} not found`);

    const [conflict] = await transaction
      .select({ teamId: teamExternalIdentities.teamId })
      .from(teamExternalIdentities)
      .where(
        and(
          eq(teamExternalIdentities.provider, input.provider),
          eq(teamExternalIdentities.externalId, value.externalId),
        ),
      )
      .limit(1);
    if (conflict && conflict.teamId !== input.teamId) {
      throw new DomainError(
        "EXTERNAL_IDENTITY_CONFLICT",
        "That provider ID is already assigned to another Team",
      );
    }

    const [before] = await transaction
      .select()
      .from(teamExternalIdentities)
      .where(
        and(
          eq(teamExternalIdentities.teamId, input.teamId),
          eq(teamExternalIdentities.provider, input.provider),
        ),
      )
      .for("update")
      .limit(1);
    const [after] = await transaction
      .insert(teamExternalIdentities)
      .values({
        externalId: value.externalId,
        externalSlug: value.externalSlug,
        lastVerifiedAt: value.lastVerifiedAt,
        provider: input.provider,
        sourceUrl: value.sourceUrl,
        teamId: input.teamId,
      })
      .onConflictDoUpdate({
        target: [teamExternalIdentities.teamId, teamExternalIdentities.provider],
        set: {
          externalId: value.externalId,
          externalSlug: value.externalSlug,
          lastVerifiedAt: value.lastVerifiedAt,
          sourceUrl: value.sourceUrl,
        },
      })
      .returning();
    const saved = requireDomainValue(
      after,
      "EXTERNAL_IDENTITY_UPDATE_FAILED",
      "Team external identity write returned no row",
    );

    await writeAdminAudit(transaction, {
      action: before ? "UPDATE_TEAM_EXTERNAL_IDENTITY" : "CREATE_TEAM_EXTERNAL_IDENTITY",
      actorAdminUserId: input.actorAdminUserId,
      after: saved,
      before: before ?? null,
      reason: value.reason,
      targetId: `${input.teamId}:${input.provider}`,
      targetType: "TEAM_EXTERNAL_IDENTITY",
    });
    return saved;
  });
}
