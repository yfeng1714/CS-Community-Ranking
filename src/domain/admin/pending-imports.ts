import { isDeepStrictEqual } from "node:util";

import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import {
  eventTeamResults,
  events,
  pendingImportChanges,
  playerExternalIdentities,
  players,
  poolPlayerEntries,
  poolTeamEntries,
  rosterMemberships,
  syncRuns,
  teamExternalIdentities,
  teams,
} from "../../db/schema/index.ts";
import { toAuditRecord, writeAdminAudit } from "../audit.ts";
import type { AppDatabase, AppTransaction } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import { createEvent, recordEventTeamResult, setEventWhitelist } from "../events/service.ts";
import {
  upsertPlayerExternalIdentity,
  upsertTeamExternalIdentity,
} from "../external-identities/service.ts";
import { createPlayer, updatePlayer } from "../players/service.ts";
import { ActivePoolCache } from "../pool/active-pool-cache.ts";
import { CandidatePoolService } from "../pool/service.ts";
import { addRosterMembership, endRosterMembership } from "../rosters/service.ts";
import { createTeam, updateTeam } from "../teams/service.ts";

const bigintId = z
  .union([z.string().regex(/^[1-9]\d{0,18}$/), z.number().int().positive().safe()])
  .transform(BigInt)
  .refine((value) => value <= 9_223_372_036_854_775_807n, "ID exceeds PostgreSQL bigint range");
const nullableText = z.string().max(500).nullable().optional();
const state = z.record(z.string(), z.unknown()).nullable();
const provider = z.enum(["HLTV", "LIQUIPEDIA", "PANDASCORE", "BO3", "OTHER"]);
const envelope = { expectedState: state, version: z.literal(1) };
const evidence = z.strictObject({
  editionYear: z.number().int().min(2000).max(9999),
  eventResults: z.array(
    z.strictObject({
      eventEndsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      eventName: z.string().trim().min(1).max(300),
      isMajor: z.boolean(),
      isT1Whitelisted: z.boolean(),
      placementFrom: z.number().int().positive(),
      placementTo: z.number().int().positive(),
    }),
  ),
  hltvRank: z.number().int().positive().nullable().optional(),
  vrsRank: z.number().int().positive().nullable().optional(),
});

const proposalSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("team.create"),
    ...envelope,
    input: z.strictObject({
      countryCode: nullableText,
      logoPath: nullableText,
      name: z.string().trim().min(1).max(200),
      shortName: nullableText,
      slug: z.string().trim().min(1).max(200),
    }),
  }),
  z.strictObject({
    action: z.literal("team.update"),
    ...envelope,
    input: z.strictObject({
      active: z.boolean().optional(),
      countryCode: nullableText,
      logoPath: nullableText,
      name: z.string().trim().min(1).max(200).optional(),
      shortName: nullableText,
      slug: z.string().trim().min(1).max(200).optional(),
      teamId: bigintId,
    }),
  }),
  z.strictObject({
    action: z.literal("team.identity.upsert"),
    ...envelope,
    input: z.strictObject({
      externalId: z.string().trim().min(1).max(500),
      externalSlug: nullableText,
      provider,
      sourceUrl: z.string().url().max(2_000),
      teamId: bigintId,
    }),
  }),
  z.strictObject({
    action: z.literal("player.create"),
    ...envelope,
    input: z.strictObject({
      countryCode: nullableText,
      hltvProfileUrl: z.string().trim().max(2_000).nullable().optional(),
      nickname: z.string().trim().min(1).max(100),
      photoPath: nullableText,
      professionalStatus: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
      realName: nullableText,
      slug: z.string().trim().min(1).max(200),
    }),
  }),
  z.strictObject({
    action: z.literal("player.update"),
    ...envelope,
    input: z.strictObject({
      countryCode: nullableText,
      hltvProfileUrl: z.string().trim().max(2_000).nullable().optional(),
      nickname: z.string().trim().min(1).max(100).optional(),
      photoPath: nullableText,
      playerId: bigintId,
      professionalStatus: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
      realName: nullableText,
      slug: z.string().trim().min(1).max(200).optional(),
    }),
  }),
  z.strictObject({
    action: z.literal("player.identity.upsert"),
    ...envelope,
    input: z.strictObject({
      externalId: z.string().trim().min(1).max(500),
      externalSlug: nullableText,
      playerId: bigintId,
      provider,
      sourceUrl: z.string().url().max(2_000),
    }),
  }),
  z.strictObject({
    action: z.literal("roster.add"),
    ...envelope,
    input: z.strictObject({
      endsAt: nullableText,
      playerId: bigintId,
      source: nullableText,
      startsAt: z.string(),
      status: z.enum(["STARTER", "BENCH", "STAND_IN"]),
      teamId: bigintId,
    }),
  }),
  z.strictObject({
    action: z.literal("roster.end"),
    ...envelope,
    input: z.strictObject({ endsAt: z.string(), membershipId: bigintId }),
  }),
  z.strictObject({
    action: z.literal("event.create"),
    ...envelope,
    input: z.strictObject({
      endsAt: z.string(),
      name: z.string().trim().min(1).max(300),
      slug: z.string().trim().min(1).max(200),
      startsAt: z.string(),
    }),
  }),
  z.strictObject({
    action: z.literal("event.whitelist"),
    ...envelope,
    input: z.strictObject({
      enabled: z.boolean(),
      eventId: bigintId,
      isMajor: z.boolean(),
      note: nullableText,
      whitelistReason: z.enum(["MAJOR", "HLTV_HIGHLIGHT", "MANUAL", "NONE"]),
    }),
  }),
  z.strictObject({
    action: z.literal("event.result"),
    ...envelope,
    input: z.strictObject({
      eventId: bigintId,
      placementFrom: z.number().int().positive(),
      placementTo: z.number().int().positive(),
      teamId: bigintId,
    }),
  }),
  z.strictObject({
    action: z.literal("pool.admit-team"),
    ...envelope,
    input: z.strictObject({ editionId: bigintId, evidence, teamId: bigintId }),
  }),
  z.strictObject({
    action: z.literal("pool.admit-team-player"),
    ...envelope,
    input: z.strictObject({ editionId: bigintId, playerId: bigintId, teamId: bigintId }),
  }),
  z.strictObject({
    action: z.literal("pool.admit-player"),
    ...envelope,
    input: z.strictObject({ editionId: bigintId, playerId: bigintId }),
  }),
  z.strictObject({
    action: z.literal("pool.pairing"),
    ...envelope,
    input: z.strictObject({ editionId: bigintId, enabled: z.boolean(), playerId: bigintId }),
  }),
]);

type Proposal = z.infer<typeof proposalSchema>;

function poolProposalEditionId(proposal: Proposal): bigint | undefined {
  switch (proposal.action) {
    case "pool.admit-team":
    case "pool.admit-team-player":
    case "pool.admit-player":
    case "pool.pairing":
      return proposal.input.editionId;
    default:
      return undefined;
  }
}

const actionChangeTypes = {
  "event.create": "EVENT",
  "event.result": "EVENT",
  "event.whitelist": "EVENT",
  "player.create": "PLAYER",
  "player.identity.upsert": "PLAYER",
  "player.update": "PLAYER",
  "pool.admit-player": "POOL_PLAYER",
  "pool.admit-team": "POOL_TEAM",
  "pool.admit-team-player": "POOL_PLAYER",
  "pool.pairing": "POOL_PLAYER",
  "roster.add": "ROSTER",
  "roster.end": "ROSTER",
  "team.create": "TEAM",
  "team.identity.upsert": "TEAM",
  "team.update": "TEAM",
} as const;

function sameState(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(
    toAuditRecord(left as object | null),
    toAuditRecord(right as object | null),
  );
}

async function loadCurrentState(transaction: AppTransaction, proposal: Proposal) {
  switch (proposal.action) {
    case "team.create":
      return (
        (
          await transaction.select().from(teams).where(eq(teams.slug, proposal.input.slug)).limit(1)
        )[0] ?? null
      );
    case "team.update":
      return (
        (
          await transaction.select().from(teams).where(eq(teams.id, proposal.input.teamId)).limit(1)
        )[0] ?? null
      );
    case "team.identity.upsert":
      return (
        (
          await transaction
            .select()
            .from(teamExternalIdentities)
            .where(
              and(
                eq(teamExternalIdentities.teamId, proposal.input.teamId),
                eq(teamExternalIdentities.provider, proposal.input.provider),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
    case "player.create":
      return (
        (
          await transaction
            .select()
            .from(players)
            .where(eq(players.slug, proposal.input.slug))
            .limit(1)
        )[0] ?? null
      );
    case "player.update":
      return (
        (
          await transaction
            .select()
            .from(players)
            .where(eq(players.id, proposal.input.playerId))
            .limit(1)
        )[0] ?? null
      );
    case "player.identity.upsert":
      return (
        (
          await transaction
            .select()
            .from(playerExternalIdentities)
            .where(
              and(
                eq(playerExternalIdentities.playerId, proposal.input.playerId),
                eq(playerExternalIdentities.provider, proposal.input.provider),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
    case "roster.add":
      return null;
    case "roster.end":
      return (
        (
          await transaction
            .select()
            .from(rosterMemberships)
            .where(eq(rosterMemberships.id, proposal.input.membershipId))
            .limit(1)
        )[0] ?? null
      );
    case "event.create":
      return (
        (
          await transaction
            .select()
            .from(events)
            .where(eq(events.slug, proposal.input.slug))
            .limit(1)
        )[0] ?? null
      );
    case "event.whitelist":
      return (
        (
          await transaction
            .select()
            .from(events)
            .where(eq(events.id, proposal.input.eventId))
            .limit(1)
        )[0] ?? null
      );
    case "event.result":
      return (
        (
          await transaction
            .select()
            .from(eventTeamResults)
            .where(
              and(
                eq(eventTeamResults.eventId, proposal.input.eventId),
                eq(eventTeamResults.teamId, proposal.input.teamId),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
    case "pool.admit-team":
      return (
        (
          await transaction
            .select()
            .from(poolTeamEntries)
            .where(
              and(
                eq(poolTeamEntries.editionId, proposal.input.editionId),
                eq(poolTeamEntries.teamId, proposal.input.teamId),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
    case "pool.admit-player":
    case "pool.admit-team-player":
    case "pool.pairing":
      return (
        (
          await transaction
            .select()
            .from(poolPlayerEntries)
            .where(
              and(
                eq(poolPlayerEntries.editionId, proposal.input.editionId),
                eq(poolPlayerEntries.playerId, proposal.input.playerId),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
  }
}

async function applyProposal(
  transaction: AppTransaction,
  proposal: Proposal,
  actorAdminUserId: bigint,
  reason: string,
): Promise<{ invalidateAllPools?: boolean; invalidateEditionId?: bigint; result: unknown }> {
  const database = transaction as unknown as AppDatabase;
  switch (proposal.action) {
    case "team.create":
      return {
        result: await createTeam(database, { ...proposal.input, actorAdminUserId, reason }),
      };
    case "team.update":
      return {
        result: await updateTeam(database, { ...proposal.input, actorAdminUserId, reason }),
      };
    case "team.identity.upsert":
      return {
        result: await upsertTeamExternalIdentity(database, {
          ...proposal.input,
          actorAdminUserId,
          reason,
        }),
      };
    case "player.create":
      return {
        result: await createPlayer(database, { ...proposal.input, actorAdminUserId, reason }),
      };
    case "player.update":
      return {
        invalidateAllPools: true,
        result: await updatePlayer(database, { ...proposal.input, actorAdminUserId, reason }),
      };
    case "player.identity.upsert":
      return {
        result: await upsertPlayerExternalIdentity(database, {
          ...proposal.input,
          actorAdminUserId,
          reason,
        }),
      };
    case "roster.add":
      return {
        result: await addRosterMembership(database, {
          ...proposal.input,
          actorAdminUserId,
          reason,
        }),
      };
    case "roster.end":
      return {
        result: await endRosterMembership(database, {
          ...proposal.input,
          actorAdminUserId,
          reason,
        }),
      };
    case "event.create":
      return {
        result: await createEvent(database, { ...proposal.input, actorAdminUserId, reason }),
      };
    case "event.whitelist":
      return {
        result: await setEventWhitelist(database, {
          ...proposal.input,
          actorAdminUserId,
          reason,
        }),
      };
    case "event.result":
      return {
        result: await recordEventTeamResult(database, {
          ...proposal.input,
          actorAdminUserId,
          reason,
        }),
      };
    case "pool.admit-team": {
      const result = await new CandidatePoolService(
        database,
        new ActivePoolCache(60_000),
      ).admitAutomaticTeam({ ...proposal.input, actorAdminUserId, reason });
      return { invalidateEditionId: proposal.input.editionId, result };
    }
    case "pool.admit-team-player": {
      const result = await new CandidatePoolService(
        database,
        new ActivePoolCache(60_000),
      ).admitTeamPlayer({ ...proposal.input, actorAdminUserId, reason });
      return { invalidateEditionId: proposal.input.editionId, result };
    }
    case "pool.admit-player": {
      const result = await new CandidatePoolService(
        database,
        new ActivePoolCache(60_000),
      ).admitSpecialPlayer({ ...proposal.input, actorAdminUserId, reason });
      return { invalidateEditionId: proposal.input.editionId, result };
    }
    case "pool.pairing": {
      const result = await new CandidatePoolService(
        database,
        new ActivePoolCache(60_000),
      ).setPairingEnabled({ ...proposal.input, actorAdminUserId, reason });
      return { invalidateEditionId: proposal.input.editionId, result };
    }
  }
}

export class PendingImportReviewService {
  private readonly activePool:
    | Partial<
        Pick<CandidatePoolService, "invalidateActivePlayerIds" | "invalidateAllActivePlayerIds">
      >
    | undefined;
  private readonly database: AppDatabase;

  constructor(
    database: AppDatabase,
    activePool?: Partial<
      Pick<CandidatePoolService, "invalidateActivePlayerIds" | "invalidateAllActivePlayerIds">
    >,
  ) {
    this.database = database;
    this.activePool = activePool;
  }

  async review(input: {
    actorAdminUserId: bigint;
    decision: "APPROVE" | "REJECT";
    pendingChangeId: bigint;
    reason: string;
  }) {
    const reason = requireNonBlank(input.reason, "Pending import review reason");
    let invalidateAllPools = false;
    let invalidateEditionId: bigint | undefined;
    const reviewed = await this.database.transaction(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(pendingImportChanges)
        .where(eq(pendingImportChanges.id, input.pendingChangeId))
        .for("update")
        .limit(1);
      const pending = requireDomainValue(
        before,
        "PENDING_IMPORT_NOT_FOUND",
        `Pending import ${input.pendingChangeId} not found`,
      );
      if (pending.status !== "PENDING") {
        throw new DomainError(
          "PENDING_IMPORT_ALREADY_REVIEWED",
          "Pending import was already reviewed",
        );
      }

      const now = new Date();
      let appliedResult: unknown = null;
      if (input.decision === "APPROVE") {
        if (pending.conflictCodes.length > 0) {
          throw new DomainError(
            "PENDING_IMPORT_HAS_CONFLICTS",
            `Resolve conflicts first: ${pending.conflictCodes.join(", ")}`,
          );
        }

        const [sourceRun] = await transaction
          .select()
          .from(syncRuns)
          .where(eq(syncRuns.id, pending.syncRunId))
          .for("update")
          .limit(1);
        const run = requireDomainValue(
          sourceRun,
          "SYNC_RUN_NOT_FOUND",
          "Source sync run not found",
        );
        if (run.status !== "SUCCEEDED" && run.status !== "PARTIAL") {
          throw new DomainError(
            "PENDING_IMPORT_SOURCE_INCOMPLETE",
            "Source sync run is not complete",
          );
        }
        const [newerRun] = await transaction
          .select({ id: syncRuns.id })
          .from(syncRuns)
          .where(
            and(
              eq(syncRuns.jobName, run.jobName),
              eq(syncRuns.provider, run.provider),
              gt(syncRuns.startedAt, run.startedAt),
            ),
          )
          .orderBy(desc(syncRuns.startedAt))
          .limit(1);
        if (newerRun) {
          throw new DomainError(
            "PENDING_IMPORT_SUPERSEDED",
            "A newer sync run exists; review its proposal instead",
          );
        }

        const proposal = proposalSchema.parse(pending.proposedData);
        if (actionChangeTypes[proposal.action] !== pending.changeType) {
          throw new DomainError(
            "PENDING_IMPORT_TYPE_MISMATCH",
            "Proposal action does not match its change type",
          );
        }
        const proposalEditionId = poolProposalEditionId(proposal);
        if (proposalEditionId !== undefined && pending.editionId !== proposalEditionId) {
          throw new DomainError(
            "PENDING_IMPORT_EDITION_MISMATCH",
            "Pool proposal Edition does not match the pending-change envelope",
          );
        }
        const currentState = await loadCurrentState(transaction, proposal);
        if (!sameState(currentState, proposal.expectedState)) {
          throw new DomainError(
            "PENDING_IMPORT_STATE_CHANGED",
            "Current database state changed after this proposal was created",
          );
        }
        const applied = await applyProposal(transaction, proposal, input.actorAdminUserId, reason);
        appliedResult = applied.result;
        invalidateAllPools = applied.invalidateAllPools ?? false;
        invalidateEditionId = applied.invalidateEditionId;
      }

      const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const [after] = await transaction
        .update(pendingImportChanges)
        .set({
          appliedAt: status === "APPROVED" ? now : null,
          reviewedAt: now,
          reviewedBy: input.actorAdminUserId,
          reviewReason: reason,
          status,
        })
        .where(eq(pendingImportChanges.id, pending.id))
        .returning();
      const result = requireDomainValue(
        after,
        "PENDING_IMPORT_REVIEW_FAILED",
        "Pending import review returned no row",
      );
      await writeAdminAudit(transaction, {
        action: status === "APPROVED" ? "APPROVE_PENDING_IMPORT" : "REJECT_PENDING_IMPORT",
        actorAdminUserId: input.actorAdminUserId,
        after: { appliedResult, pendingChange: result },
        before: pending,
        reason,
        targetId: pending.id.toString(),
        targetType: "PENDING_IMPORT_CHANGE",
      });
      return result;
    });

    if (invalidateAllPools) {
      this.activePool?.invalidateAllActivePlayerIds?.();
    } else if (invalidateEditionId !== undefined) {
      this.activePool?.invalidateActivePlayerIds?.(invalidateEditionId);
    }
    return reviewed;
  }
}
