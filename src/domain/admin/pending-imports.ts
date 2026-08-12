import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import {
  events,
  pendingImportChanges,
  players,
  poolPlayerEntries,
  poolTeamEntries,
  rosterMemberships,
  syncRuns,
  teams,
} from "../../db/schema/index.ts";
import { toAuditRecord, writeAdminAudit } from "../audit.ts";
import type { AppDatabase, AppTransaction } from "../database.ts";
import { createEdition, transitionEdition } from "../editions/service.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import { createEvent, setEventWhitelist } from "../events/service.ts";
import { createPlayer, updatePlayer } from "../players/service.ts";
import { ActivePoolCache } from "../pool/active-pool-cache.ts";
import { CandidatePoolService } from "../pool/service.ts";
import { addRosterMembership, endRosterMembership } from "../rosters/service.ts";
import { createTeam, updateTeam } from "../teams/service.ts";

const bigintId = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive()])
  .transform(BigInt);
const nullableText = z.string().nullable().optional();

const proposalSchema = z.object({
  action: z.enum([
    "team.create",
    "team.update",
    "player.create",
    "player.update",
    "roster.add",
    "roster.end",
    "edition.create",
    "edition.transition",
    "event.create",
    "event.whitelist",
    "pool.admit-team",
    "pool.admit-player",
    "pool.pairing",
  ]),
  expectedState: z.record(z.string(), z.unknown()).nullable(),
  input: z.record(z.string(), z.unknown()),
  version: z.literal(1),
});

const actionChangeTypes = {
  "team.create": "TEAM",
  "team.update": "TEAM",
  "player.create": "PLAYER",
  "player.update": "PLAYER",
  "roster.add": "ROSTER",
  "roster.end": "ROSTER",
  "edition.create": "EVENT",
  "edition.transition": "EVENT",
  "event.create": "EVENT",
  "event.whitelist": "EVENT",
  "pool.admit-team": "POOL_TEAM",
  "pool.admit-player": "POOL_PLAYER",
  "pool.pairing": "POOL_PLAYER",
} as const;

function sameState(left: unknown, right: unknown): boolean {
  return JSON.stringify(toAuditRecord(left as object | null)) === JSON.stringify(right);
}

async function loadCurrentState(
  transaction: AppTransaction,
  proposal: z.infer<typeof proposalSchema>,
  targetExternalKey: string,
) {
  const input = proposal.input;
  switch (proposal.action) {
    case "team.create":
    case "team.update":
      return (
        (
          await transaction.select().from(teams).where(eq(teams.slug, targetExternalKey)).limit(1)
        )[0] ?? null
      );
    case "player.create":
    case "player.update":
      return (
        (
          await transaction
            .select()
            .from(players)
            .where(eq(players.slug, targetExternalKey))
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
            .where(eq(rosterMemberships.id, bigintId.parse(input.membershipId)))
            .limit(1)
        )[0] ?? null
      );
    case "event.create":
    case "event.whitelist":
      return (
        (
          await transaction.select().from(events).where(eq(events.slug, targetExternalKey)).limit(1)
        )[0] ?? null
      );
    case "edition.create":
      return null;
    case "edition.transition":
      return null;
    case "pool.admit-team":
      return (
        (
          await transaction
            .select()
            .from(poolTeamEntries)
            .where(
              and(
                eq(poolTeamEntries.editionId, bigintId.parse(input.editionId)),
                eq(poolTeamEntries.teamId, bigintId.parse(input.teamId)),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
    case "pool.admit-player":
    case "pool.pairing":
      return (
        (
          await transaction
            .select()
            .from(poolPlayerEntries)
            .where(
              and(
                eq(poolPlayerEntries.editionId, bigintId.parse(input.editionId)),
                eq(poolPlayerEntries.playerId, bigintId.parse(input.playerId)),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
  }
}

async function applyProposal(
  transaction: AppTransaction,
  proposal: z.infer<typeof proposalSchema>,
  actorAdminUserId: bigint,
  reason: string,
) {
  const database = transaction as unknown as AppDatabase;
  const input = proposal.input;
  switch (proposal.action) {
    case "team.create": {
      const value = z
        .object({
          countryCode: nullableText,
          logoPath: nullableText,
          name: z.string(),
          shortName: nullableText,
          slug: z.string(),
        })
        .parse(input);
      return createTeam(database, { ...value, actorAdminUserId, reason });
    }
    case "team.update": {
      const value = z
        .object({
          active: z.boolean().optional(),
          countryCode: nullableText,
          logoPath: nullableText,
          name: z.string().optional(),
          shortName: nullableText,
          slug: z.string().optional(),
          teamId: bigintId,
        })
        .parse(input);
      return updateTeam(database, { ...value, actorAdminUserId, reason });
    }
    case "player.create": {
      const value = z
        .object({
          countryCode: nullableText,
          nickname: z.string(),
          photoPath: nullableText,
          professionalStatus: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
          realName: nullableText,
          slug: z.string(),
        })
        .parse(input);
      return createPlayer(database, { ...value, actorAdminUserId, reason });
    }
    case "player.update": {
      const value = z
        .object({
          countryCode: nullableText,
          nickname: z.string().optional(),
          photoPath: nullableText,
          playerId: bigintId,
          professionalStatus: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
          realName: nullableText,
          slug: z.string().optional(),
        })
        .parse(input);
      return updatePlayer(database, { ...value, actorAdminUserId, reason });
    }
    case "roster.add": {
      const value = z
        .object({
          endsAt: nullableText,
          playerId: bigintId,
          source: nullableText,
          startsAt: z.string(),
          status: z.enum(["STARTER", "BENCH", "STAND_IN"]),
          teamId: bigintId,
        })
        .parse(input);
      return addRosterMembership(database, { ...value, actorAdminUserId, reason });
    }
    case "roster.end": {
      const value = z.object({ endsAt: z.string(), membershipId: bigintId }).parse(input);
      return endRosterMembership(database, { ...value, actorAdminUserId, reason });
    }
    case "edition.create": {
      const value = z
        .object({
          ballotTtlMinutes: z.number().int().positive(),
          code: z.string(),
          endsAt: z.coerce.date(),
          fullWeightBallotsPerDay: z.number().int().nonnegative(),
          name: z.string(),
          startsAt: z.coerce.date(),
        })
        .parse(input);
      return createEdition(database, { ...value, actorAdminUserId, reason });
    }
    case "edition.transition": {
      const value = z
        .object({
          editionId: bigintId,
          status: z.enum(["DRAFT", "ACTIVE", "FROZEN", "ARCHIVED"]),
        })
        .parse(input);
      return transitionEdition(database, { ...value, actorAdminUserId, reason });
    }
    case "event.create": {
      const value = z
        .object({
          endsAt: z.string(),
          name: z.string(),
          slug: z.string(),
          startsAt: z.string(),
        })
        .parse(input);
      return createEvent(database, { ...value, actorAdminUserId, reason });
    }
    case "event.whitelist": {
      const value = z
        .object({
          enabled: z.boolean(),
          eventId: bigintId,
          isMajor: z.boolean(),
          note: nullableText,
          whitelistReason: z.enum(["MAJOR", "HLTV_HIGHLIGHT", "MANUAL", "NONE"]),
        })
        .parse(input);
      return setEventWhitelist(database, { ...value, actorAdminUserId, reason });
    }
    case "pool.admit-team": {
      const value = z.object({ editionId: bigintId, teamId: bigintId }).parse(input);
      return new CandidatePoolService(database, new ActivePoolCache(60_000)).admitManualTeam({
        ...value,
        actorAdminUserId,
        reason,
      });
    }
    case "pool.admit-player": {
      const value = z.object({ editionId: bigintId, playerId: bigintId }).parse(input);
      return new CandidatePoolService(database, new ActivePoolCache(60_000)).admitSpecialPlayer({
        ...value,
        actorAdminUserId,
        reason,
      });
    }
    case "pool.pairing": {
      const value = z
        .object({ editionId: bigintId, enabled: z.boolean(), playerId: bigintId })
        .parse(input);
      return new CandidatePoolService(database, new ActivePoolCache(60_000)).setPairingEnabled({
        ...value,
        actorAdminUserId,
        reason,
      });
    }
  }
}

export class PendingImportReviewService {
  constructor(private readonly database: AppDatabase) {}

  async review(input: {
    actorAdminUserId: bigint;
    decision: "APPROVE" | "REJECT";
    pendingChangeId: bigint;
    reason: string;
  }) {
    const reason = requireNonBlank(input.reason, "Pending import review reason");
    return this.database.transaction(async (transaction) => {
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
        const currentState = await loadCurrentState(
          transaction,
          proposal,
          pending.targetExternalKey,
        );
        if (!sameState(currentState, proposal.expectedState)) {
          throw new DomainError(
            "PENDING_IMPORT_STATE_CHANGED",
            "Current database state changed after this proposal was created",
          );
        }
        appliedResult = await applyProposal(transaction, proposal, input.actorAdminUserId, reason);
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
      const reviewed = requireDomainValue(
        after,
        "PENDING_IMPORT_REVIEW_FAILED",
        "Pending import review returned no row",
      );
      await writeAdminAudit(transaction, {
        action: status === "APPROVED" ? "APPROVE_PENDING_IMPORT" : "REJECT_PENDING_IMPORT",
        actorAdminUserId: input.actorAdminUserId,
        after: { appliedResult, pendingChange: reviewed },
        before: pending,
        reason,
        targetId: pending.id.toString(),
        targetType: "PENDING_IMPORT_CHANGE",
      });
      return reviewed;
    });
  }
}
