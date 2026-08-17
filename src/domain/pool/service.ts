import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { toAuditRecord, writeAdminAudit } from "../audit.ts";
import type { AppDatabase, AppTransaction } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import {
  adminUsers,
  editions,
  players,
  playerRankings,
  poolChangeLogs,
  poolPlayerEntries,
  poolTeamEntries,
  rosterMemberships,
  teams,
} from "../../db/schema/index.ts";
import { ActivePoolCache } from "./active-pool-cache.ts";
import {
  evaluateAutomaticTeamAdmission,
  evaluateManualTeamAdmission,
  evaluateSpecialPlayerAdmission,
  isPairingEligibleProfessionalStatus,
  PAIRING_ELIGIBLE_PROFESSIONAL_STATUSES,
  type AutomaticTeamEvidence,
} from "./rules.ts";

type TeamAdmissionType = "CORE" | "REVIEW_AUTO" | "REVIEW_MANUAL";

interface MutationContext {
  actorAdminUserId: bigint;
  reason: string;
}

async function requireModifiableEdition(transaction: AppTransaction, editionId: bigint) {
  const [edition] = await transaction
    .select()
    .from(editions)
    .where(eq(editions.id, editionId))
    .for("update")
    .limit(1);
  const found = requireDomainValue(
    edition,
    "EDITION_NOT_FOUND",
    `Edition ${editionId} does not exist`,
  );

  if (found.status === "FROZEN" || found.status === "ARCHIVED") {
    throw new DomainError(
      "EDITION_POOL_IMMUTABLE",
      `Candidate Pool cannot change while Edition is ${found.status}`,
    );
  }

  return found;
}

async function writePoolChange(
  transaction: AppTransaction,
  input: {
    action: string;
    actorAdminUserId: bigint;
    after?: object | null;
    before?: object | null;
    editionId: bigint;
    reason: string;
    targetId: string;
    targetType: "POOL_TEAM" | "POOL_PLAYER" | "PAIRING_STATE";
  },
): Promise<void> {
  await transaction.insert(poolChangeLogs).values({
    action: input.action,
    actorAdminUserId: input.actorAdminUserId,
    after: toAuditRecord(input.after),
    before: toAuditRecord(input.before),
    editionId: input.editionId,
    reason: input.reason,
    targetId: input.targetId,
    targetType: input.targetType,
  });
}

async function admitTeamAndCurrentStarters(
  transaction: AppTransaction,
  input: MutationContext & {
    admissionReason: string;
    admissionType: TeamAdmissionType;
    editionId: bigint;
    evidenceEditionYear?: number;
    teamId: bigint;
  },
) {
  const edition = await requireModifiableEdition(transaction, input.editionId);
  if (
    input.evidenceEditionYear !== undefined &&
    Number(edition.code) !== input.evidenceEditionYear
  ) {
    throw new DomainError(
      "EVIDENCE_EDITION_MISMATCH",
      `Admission evidence is for ${input.evidenceEditionYear}, not Edition ${edition.code}`,
    );
  }

  const [team] = await transaction
    .select()
    .from(teams)
    .where(eq(teams.id, input.teamId))
    .for("update")
    .limit(1);
  const admittedTeam = requireDomainValue(
    team,
    "TEAM_NOT_FOUND",
    `Team ${input.teamId} does not exist`,
  );

  if (!admittedTeam.active) {
    throw new DomainError("TEAM_NOT_ACTIVE", "An inactive Team cannot be admitted to the Pool");
  }

  const [existingTeamEntry] = await transaction
    .select({ id: poolTeamEntries.id })
    .from(poolTeamEntries)
    .where(
      and(eq(poolTeamEntries.editionId, input.editionId), eq(poolTeamEntries.teamId, input.teamId)),
    )
    .limit(1);
  if (existingTeamEntry) {
    throw new DomainError("TEAM_ALREADY_ADMITTED", "Team is already admitted to this Edition");
  }

  const starters = await transaction
    .select({
      playerId: players.id,
      professionalStatus: players.professionalStatus,
    })
    .from(rosterMemberships)
    .innerJoin(players, eq(players.id, rosterMemberships.playerId))
    .where(
      and(
        eq(rosterMemberships.teamId, input.teamId),
        eq(rosterMemberships.status, "STARTER"),
        isNull(rosterMemberships.endsAt),
      ),
    )
    .orderBy(asc(players.id));

  if (starters.length !== 5) {
    throw new DomainError(
      "FORMAL_STARTING_FIVE_REQUIRED",
      `Team admission requires exactly five current starters; found ${starters.length}`,
    );
  }

  if (starters.some((starter) => starter.professionalStatus !== "ACTIVE")) {
    throw new DomainError(
      "STARTER_NOT_ACTIVE",
      "Every admitted formal starter must have ACTIVE professional status",
    );
  }

  const [teamEntry] = await transaction
    .insert(poolTeamEntries)
    .values({
      admissionReason: input.admissionReason,
      admissionType: input.admissionType,
      approvedBy: input.actorAdminUserId,
      editionId: input.editionId,
      teamId: input.teamId,
    })
    .returning();
  const createdTeamEntry = requireDomainValue(
    teamEntry,
    "POOL_TEAM_CREATE_FAILED",
    "Pool Team insertion returned no row",
  );

  await writePoolChange(transaction, {
    action: "ADMIT_TEAM",
    actorAdminUserId: input.actorAdminUserId,
    after: createdTeamEntry,
    editionId: input.editionId,
    reason: input.reason,
    targetId: createdTeamEntry.id.toString(),
    targetType: "POOL_TEAM",
  });

  const admittedPlayerIds: bigint[] = [];
  const alreadyAdmittedPlayerIds: bigint[] = [];

  for (const starter of starters) {
    const [existingPlayerEntry] = await transaction
      .select()
      .from(poolPlayerEntries)
      .where(
        and(
          eq(poolPlayerEntries.editionId, input.editionId),
          eq(poolPlayerEntries.playerId, starter.playerId),
        ),
      )
      .limit(1);

    if (existingPlayerEntry) {
      alreadyAdmittedPlayerIds.push(starter.playerId);
    } else {
      const [playerEntry] = await transaction
        .insert(poolPlayerEntries)
        .values({
          admissionReason: input.admissionReason,
          admissionType: input.admissionType,
          approvedBy: input.actorAdminUserId,
          editionId: input.editionId,
          playerId: starter.playerId,
          sourceTeamEntryId: createdTeamEntry.id,
        })
        .returning();
      const createdPlayerEntry = requireDomainValue(
        playerEntry,
        "POOL_PLAYER_CREATE_FAILED",
        "Pool Player insertion returned no row",
      );
      admittedPlayerIds.push(starter.playerId);

      await writePoolChange(transaction, {
        action: "ADMIT_TEAM_PLAYER",
        actorAdminUserId: input.actorAdminUserId,
        after: createdPlayerEntry,
        editionId: input.editionId,
        reason: input.reason,
        targetId: createdPlayerEntry.id.toString(),
        targetType: "POOL_PLAYER",
      });
    }

    await transaction
      .insert(playerRankings)
      .values({ editionId: input.editionId, playerId: starter.playerId })
      .onConflictDoNothing();
  }

  const result = {
    alreadyAdmittedPlayerIds,
    admittedPlayerIds,
    teamEntry: createdTeamEntry,
  };

  await writeAdminAudit(transaction, {
    action: "ADMIT_POOL_TEAM",
    actorAdminUserId: input.actorAdminUserId,
    after: result,
    reason: input.reason,
    targetId: createdTeamEntry.id.toString(),
    targetType: "POOL_TEAM",
  });

  return result;
}

async function admitSpecialPlayerInTransaction(
  transaction: AppTransaction,
  input: MutationContext & {
    editionId: bigint;
    playerId: bigint;
  },
) {
  await requireModifiableEdition(transaction, input.editionId);

  const [player] = await transaction
    .select()
    .from(players)
    .where(eq(players.id, input.playerId))
    .for("update")
    .limit(1);
  const candidate = requireDomainValue(
    player,
    "PLAYER_NOT_FOUND",
    `Player ${input.playerId} does not exist`,
  );
  const evaluation = evaluateSpecialPlayerAdmission({
    approved: true,
    professionalStatus: candidate.professionalStatus,
    reason: input.reason,
  });

  if (!evaluation.eligible || !evaluation.reason) {
    throw new DomainError(
      "SPECIAL_ADMISSION_REJECTED",
      `Special admission rejected: ${evaluation.reasonCodes.join(", ")}`,
    );
  }

  const [existing] = await transaction
    .select({ id: poolPlayerEntries.id })
    .from(poolPlayerEntries)
    .where(
      and(
        eq(poolPlayerEntries.editionId, input.editionId),
        eq(poolPlayerEntries.playerId, input.playerId),
      ),
    )
    .limit(1);
  if (existing) {
    throw new DomainError("PLAYER_ALREADY_ADMITTED", "Player is already in this Edition's Pool");
  }

  const [entry] = await transaction
    .insert(poolPlayerEntries)
    .values({
      admissionReason: evaluation.reason,
      admissionType: "SPECIAL",
      approvedBy: input.actorAdminUserId,
      editionId: input.editionId,
      playerId: input.playerId,
      sourceTeamEntryId: null,
    })
    .returning();
  const created = requireDomainValue(
    entry,
    "POOL_PLAYER_CREATE_FAILED",
    "Pool Player insertion returned no row",
  );

  await transaction
    .insert(playerRankings)
    .values({ editionId: input.editionId, playerId: input.playerId })
    .onConflictDoNothing();

  await writePoolChange(transaction, {
    action: "ADMIT_SPECIAL_PLAYER",
    actorAdminUserId: input.actorAdminUserId,
    after: created,
    editionId: input.editionId,
    reason: input.reason,
    targetId: created.id.toString(),
    targetType: "POOL_PLAYER",
  });
  await writeAdminAudit(transaction, {
    action: "ADMIT_SPECIAL_POOL_PLAYER",
    actorAdminUserId: input.actorAdminUserId,
    after: created,
    reason: input.reason,
    targetId: created.id.toString(),
    targetType: "POOL_PLAYER",
  });

  return created;
}

export class CandidatePoolService {
  private readonly cache: ActivePoolCache;
  private readonly database: AppDatabase;

  constructor(database: AppDatabase, cache: ActivePoolCache) {
    this.database = database;
    this.cache = cache;
  }

  async admitAutomaticTeam(
    input: MutationContext & {
      editionId: bigint;
      evidence: AutomaticTeamEvidence;
      teamId: bigint;
    },
  ) {
    const evaluation = evaluateAutomaticTeamAdmission(input.evidence);
    if (!evaluation.eligible || !evaluation.admissionType || !evaluation.reason) {
      throw new DomainError(
        "AUTOMATIC_ADMISSION_REJECTED",
        `Team does not satisfy Core or Review Auto rules: ${evaluation.reasonCodes.join(", ")}`,
      );
    }

    const admissionType = evaluation.admissionType;
    const admissionReason = evaluation.reason;

    const result = await this.database.transaction((transaction) =>
      admitTeamAndCurrentStarters(transaction, {
        ...input,
        admissionReason,
        admissionType,
        evidenceEditionYear: input.evidence.editionYear,
      }),
    );
    this.cache.invalidate(input.editionId);
    return result;
  }

  async admitManualTeam(
    input: MutationContext & {
      editionId: bigint;
      teamId: bigint;
    },
  ) {
    const evaluation = evaluateManualTeamAdmission({ approved: true, reason: input.reason });
    const admissionReason = requireDomainValue(
      evaluation.reason,
      "MANUAL_ADMISSION_REJECTED",
      "Manual admission requires approval and a reason",
    );

    const result = await this.database.transaction((transaction) =>
      admitTeamAndCurrentStarters(transaction, {
        ...input,
        admissionReason,
        admissionType: "REVIEW_MANUAL",
      }),
    );
    this.cache.invalidate(input.editionId);
    return result;
  }

  async admitSpecialPlayer(
    input: MutationContext & {
      editionId: bigint;
      playerId: bigint;
    },
  ) {
    const result = await this.database.transaction((transaction) =>
      admitSpecialPlayerInTransaction(transaction, input),
    );
    this.cache.invalidate(input.editionId);
    return result;
  }

  async admitTeamPlayer(
    input: MutationContext & {
      editionId: bigint;
      playerId: bigint;
      teamId: bigint;
    },
  ) {
    const reason = requireNonBlank(input.reason, "Team player admission reason");
    const result = await this.database.transaction(async (transaction) => {
      await requireModifiableEdition(transaction, input.editionId);

      const [teamEntry] = await transaction
        .select()
        .from(poolTeamEntries)
        .where(
          and(
            eq(poolTeamEntries.editionId, input.editionId),
            eq(poolTeamEntries.teamId, input.teamId),
          ),
        )
        .for("update")
        .limit(1);
      const admittedTeam = requireDomainValue(
        teamEntry,
        "POOL_TEAM_NOT_FOUND",
        "Team is not admitted to this Edition",
      );
      const [team] = await transaction
        .select({ active: teams.active })
        .from(teams)
        .where(eq(teams.id, input.teamId))
        .limit(1);
      if (!team?.active) {
        throw new DomainError("TEAM_NOT_ACTIVE", "An inactive Team cannot add a Pool player");
      }

      const [player] = await transaction
        .select({ professionalStatus: players.professionalStatus })
        .from(players)
        .where(eq(players.id, input.playerId))
        .for("update")
        .limit(1);
      const admittedPlayer = requireDomainValue(
        player,
        "PLAYER_NOT_FOUND",
        `Player ${input.playerId} does not exist`,
      );
      if (admittedPlayer.professionalStatus !== "ACTIVE") {
        throw new DomainError("PLAYER_NOT_ACTIVE", "Only an ACTIVE player can join the Pool");
      }

      const [membership] = await transaction
        .select({ id: rosterMemberships.id })
        .from(rosterMemberships)
        .where(
          and(
            eq(rosterMemberships.playerId, input.playerId),
            eq(rosterMemberships.teamId, input.teamId),
            eq(rosterMemberships.status, "STARTER"),
            isNull(rosterMemberships.endsAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!membership) {
        throw new DomainError(
          "FORMAL_STARTER_REQUIRED",
          "Player must be a current formal starter for the admitted Team",
        );
      }

      const [existing] = await transaction
        .select({ id: poolPlayerEntries.id })
        .from(poolPlayerEntries)
        .where(
          and(
            eq(poolPlayerEntries.editionId, input.editionId),
            eq(poolPlayerEntries.playerId, input.playerId),
          ),
        )
        .limit(1);
      if (existing) {
        throw new DomainError(
          "PLAYER_ALREADY_ADMITTED",
          "Player is already in this Edition's Pool",
        );
      }

      const [entry] = await transaction
        .insert(poolPlayerEntries)
        .values({
          admissionReason: reason,
          admissionType: admittedTeam.admissionType,
          approvedBy: input.actorAdminUserId,
          editionId: input.editionId,
          playerId: input.playerId,
          sourceTeamEntryId: admittedTeam.id,
        })
        .returning();
      const created = requireDomainValue(
        entry,
        "POOL_PLAYER_CREATE_FAILED",
        "Pool Player insertion returned no row",
      );

      await transaction
        .insert(playerRankings)
        .values({ editionId: input.editionId, playerId: input.playerId })
        .onConflictDoNothing();
      await writePoolChange(transaction, {
        action: "ADMIT_TEAM_PLAYER",
        actorAdminUserId: input.actorAdminUserId,
        after: created,
        editionId: input.editionId,
        reason,
        targetId: created.id.toString(),
        targetType: "POOL_PLAYER",
      });
      await writeAdminAudit(transaction, {
        action: "ADMIT_POOL_TEAM_PLAYER",
        actorAdminUserId: input.actorAdminUserId,
        after: created,
        reason,
        targetId: created.id.toString(),
        targetType: "POOL_PLAYER",
      });

      return created;
    });
    this.cache.invalidate(input.editionId);
    return result;
  }

  async createAndAdmitSpecialPlayer(
    input: MutationContext & {
      countryCode?: string | null;
      editionId: bigint;
      nickname: string;
      photoPath?: string | null;
      realName?: string | null;
      slug: string;
    },
  ) {
    const slug = requireNonBlank(input.slug, "Player slug");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new DomainError("INVALID_PLAYER_SLUG", "Player slug must be lowercase kebab-case");
    }

    const result = await this.database.transaction(async (transaction) => {
      const [player] = await transaction
        .insert(players)
        .values({
          countryCode: input.countryCode?.trim() || null,
          nickname: requireNonBlank(input.nickname, "Player nickname"),
          photoPath: input.photoPath?.trim() || null,
          professionalStatus: "ACTIVE",
          realName: input.realName?.trim() || null,
          slug,
        })
        .returning();
      const createdPlayer = requireDomainValue(
        player,
        "PLAYER_CREATE_FAILED",
        "Player insertion returned no row",
      );

      await writeAdminAudit(transaction, {
        action: "CREATE_PLAYER",
        actorAdminUserId: input.actorAdminUserId,
        after: createdPlayer,
        reason: input.reason,
        targetId: createdPlayer.id.toString(),
        targetType: "PLAYER",
      });

      const poolEntry = await admitSpecialPlayerInTransaction(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        editionId: input.editionId,
        playerId: createdPlayer.id,
        reason: input.reason,
      });

      return { player: createdPlayer, poolEntry };
    });
    this.cache.invalidate(input.editionId);
    return result;
  }

  async setPairingEnabled(
    input: MutationContext & {
      editionId: bigint;
      enabled: boolean;
      playerId: bigint;
    },
  ) {
    const reason = requireNonBlank(input.reason, "Pairing state reason");
    const result = await this.database.transaction(async (transaction) => {
      await requireModifiableEdition(transaction, input.editionId);

      const [before] = await transaction
        .select()
        .from(poolPlayerEntries)
        .where(
          and(
            eq(poolPlayerEntries.editionId, input.editionId),
            eq(poolPlayerEntries.playerId, input.playerId),
          ),
        )
        .for("update")
        .limit(1);
      const current = requireDomainValue(
        before,
        "POOL_PLAYER_NOT_FOUND",
        "Player is not admitted to this Edition",
      );

      if (current.pairingEnabled === input.enabled) {
        return { changed: false, entry: current };
      }

      if (input.enabled) {
        const [player] = await transaction
          .select({ professionalStatus: players.professionalStatus })
          .from(players)
          .where(eq(players.id, input.playerId))
          .limit(1);
        if (!player || !isPairingEligibleProfessionalStatus(player.professionalStatus)) {
          throw new DomainError(
            "PLAYER_NOT_ACTIVE",
            "Only an ACTIVE or RETIRED professional player can be enabled for pairing",
          );
        }
      }

      const [after] = await transaction
        .update(poolPlayerEntries)
        .set({
          pairingDisabledAt: input.enabled ? null : new Date(),
          pairingDisabledReason: input.enabled ? null : reason,
          pairingEnabled: input.enabled,
        })
        .where(eq(poolPlayerEntries.id, current.id))
        .returning();
      const updated = requireDomainValue(
        after,
        "PAIRING_STATE_UPDATE_FAILED",
        "Pairing state update returned no row",
      );

      await writePoolChange(transaction, {
        action: input.enabled ? "ENABLE_PAIRING" : "DISABLE_PAIRING",
        actorAdminUserId: input.actorAdminUserId,
        after: updated,
        before: current,
        editionId: input.editionId,
        reason,
        targetId: updated.id.toString(),
        targetType: "PAIRING_STATE",
      });
      await writeAdminAudit(transaction, {
        action: input.enabled ? "ENABLE_POOL_PLAYER_PAIRING" : "DISABLE_POOL_PLAYER_PAIRING",
        actorAdminUserId: input.actorAdminUserId,
        after: updated,
        before: current,
        reason,
        targetId: updated.id.toString(),
        targetType: "POOL_PLAYER",
      });

      return { changed: true, entry: updated };
    });

    if (result.changed) {
      this.cache.invalidate(input.editionId);
    }
    return result;
  }

  async getActivePlayerIds(editionId: bigint): Promise<readonly bigint[]> {
    return this.cache.get(editionId, async () => {
      const rows = await this.database
        .select({ playerId: poolPlayerEntries.playerId })
        .from(poolPlayerEntries)
        .innerJoin(players, eq(players.id, poolPlayerEntries.playerId))
        .where(
          and(
            eq(poolPlayerEntries.editionId, editionId),
            eq(poolPlayerEntries.pairingEnabled, true),
            inArray(players.professionalStatus, [...PAIRING_ELIGIBLE_PROFESSIONAL_STATUSES]),
          ),
        )
        .orderBy(asc(poolPlayerEntries.playerId));
      return rows.map((row) => row.playerId);
    });
  }

  invalidateActivePlayerIds(editionId: bigint): void {
    this.cache.invalidate(editionId);
  }

  invalidateAllActivePlayerIds(): void {
    this.cache.clear();
  }
}

export async function resolvePoolCliReferences(
  database: AppDatabase,
  input: { actorUsername: string; editionCode: string; playerSlug?: string },
): Promise<{ actorAdminUserId: bigint; editionId: bigint; playerId?: bigint }> {
  const [actor] = await database
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.username, input.actorUsername))
    .limit(1);
  const [edition] = await database
    .select({ id: editions.id })
    .from(editions)
    .where(eq(editions.code, input.editionCode))
    .limit(1);
  const player = input.playerSlug
    ? (
        await database
          .select({ id: players.id })
          .from(players)
          .where(eq(players.slug, input.playerSlug))
          .limit(1)
      )[0]
    : undefined;

  return {
    actorAdminUserId: requireDomainValue(
      actor,
      "ADMIN_ACTOR_NOT_FOUND",
      `Admin actor ${input.actorUsername} not found`,
    ).id,
    editionId: requireDomainValue(
      edition,
      "EDITION_NOT_FOUND",
      `Edition ${input.editionCode} not found`,
    ).id,
    ...(input.playerSlug
      ? {
          playerId: requireDomainValue(
            player,
            "PLAYER_NOT_FOUND",
            `Player ${input.playerSlug} not found`,
          ).id,
        }
      : {}),
  };
}
