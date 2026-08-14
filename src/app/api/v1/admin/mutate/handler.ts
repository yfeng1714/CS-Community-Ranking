import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { AppEnv } from "@/config/env";
import { toAuditRecord } from "@/domain/audit";
import type { AppDatabase } from "@/domain/database";
import type { AdminSessionService } from "@/domain/admin/auth";
import { PendingImportReviewService } from "@/domain/admin/pending-imports";
import { createEdition, transitionEdition } from "@/domain/editions/service";
import { createEvent, recordEventTeamResult, setEventWhitelist } from "@/domain/events/service";
import {
  upsertPlayerExternalIdentity,
  upsertTeamExternalIdentity,
} from "@/domain/external-identities/service";
import { createPlayer, updatePlayer } from "@/domain/players/service";
import type { CandidatePoolService } from "@/domain/pool/service";
import { addRosterMembership, endRosterMembership } from "@/domain/rosters/service";
import { createTeam, updateTeam } from "@/domain/teams/service";
import { VoteModerationService } from "@/domain/votes/moderation";
import { approveRankingSourceSnapshot } from "@/domain/external-data/snapshots";
import { checkLaunchReadiness } from "@/domain/launch/readiness";
import { DomainError } from "@/domain/error";

import {
  adminErrorResponse,
  authenticateAdminRequest,
  guardAdminMutation,
  handleAdminError,
} from "../shared";

const id = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .transform(BigInt)
  .refine((value) => value <= 9_223_372_036_854_775_807n, "ID exceeds PostgreSQL bigint range");
const reason = z.string().trim().min(3).max(500);
const nullableText = z.string().trim().max(500).nullable().optional();
const provider = z.enum(["HLTV", "LIQUIPEDIA", "PANDASCORE", "BO3", "OTHER"]);
const timestamp = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const base = { reason };

const mutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("team.create"),
    ...base,
    countryCode: nullableText,
    logoPath: nullableText,
    name: z.string().trim().min(1).max(200),
    shortName: nullableText,
    slug: z.string().trim(),
  }),
  z.strictObject({
    action: z.literal("team.update"),
    ...base,
    active: z.boolean().optional(),
    countryCode: nullableText,
    logoPath: nullableText,
    name: z.string().trim().min(1).max(200).optional(),
    shortName: nullableText,
    slug: z.string().trim().optional(),
    teamId: id,
  }),
  z.strictObject({
    action: z.literal("player.create"),
    ...base,
    countryCode: nullableText,
    hltvProfileUrl: z.string().trim().max(2_000).nullable().optional(),
    nickname: z.string().trim().min(1).max(100),
    photoPath: nullableText,
    professionalStatus: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
    realName: nullableText,
    slug: z.string().trim(),
  }),
  z.strictObject({
    action: z.literal("player.update"),
    ...base,
    countryCode: nullableText,
    hltvProfileUrl: z.string().trim().max(2_000).nullable().optional(),
    nickname: z.string().trim().min(1).max(100).optional(),
    photoPath: nullableText,
    playerId: id,
    professionalStatus: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
    realName: nullableText,
    slug: z.string().trim().optional(),
  }),
  z.strictObject({
    action: z.literal("team.identity.upsert"),
    ...base,
    externalId: z.string().trim().min(1).max(500),
    externalSlug: nullableText,
    provider,
    sourceUrl: z.string().url().max(2_000),
    teamId: id,
  }),
  z.strictObject({
    action: z.literal("player.identity.upsert"),
    ...base,
    externalId: z.string().trim().min(1).max(500),
    externalSlug: nullableText,
    playerId: id,
    provider,
    sourceUrl: z.string().url().max(2_000),
  }),
  z.strictObject({
    action: z.literal("roster.add"),
    ...base,
    endsAt: nullableText,
    playerId: id,
    source: nullableText,
    startsAt: z.string(),
    status: z.enum(["STARTER", "BENCH", "STAND_IN"]),
    teamId: id,
  }),
  z.strictObject({
    action: z.literal("roster.end"),
    ...base,
    endsAt: z.string(),
    membershipId: id,
  }),
  z.strictObject({
    action: z.literal("edition.create"),
    ...base,
    ballotTtlMinutes: z.number().int().positive(),
    code: z.string(),
    endsAt: timestamp,
    fullWeightBallotsPerDay: z.number().int().nonnegative(),
    name: z.string(),
    startsAt: timestamp,
  }),
  z.strictObject({
    action: z.literal("edition.transition"),
    ...base,
    editionId: id,
    status: z.enum(["DRAFT", "ACTIVE", "FROZEN", "ARCHIVED"]),
  }),
  z.strictObject({
    action: z.literal("event.create"),
    ...base,
    endsAt: z.string(),
    name: z.string(),
    slug: z.string(),
    startsAt: z.string(),
  }),
  z.strictObject({
    action: z.literal("event.whitelist"),
    ...base,
    enabled: z.boolean(),
    eventId: id,
    isMajor: z.boolean(),
    note: nullableText,
    whitelistReason: z.enum(["MAJOR", "HLTV_HIGHLIGHT", "MANUAL", "NONE"]),
  }),
  z.strictObject({
    action: z.literal("event.result"),
    ...base,
    eventId: id,
    placementFrom: z.number().int().positive(),
    placementTo: z.number().int().positive(),
    teamId: id,
  }),
  z.strictObject({
    action: z.literal("pool.admit-team"),
    ...base,
    editionId: id,
    teamId: id,
  }),
  z.strictObject({
    action: z.literal("pool.admit-player"),
    ...base,
    editionId: id,
    playerId: id,
  }),
  z.strictObject({
    action: z.literal("pool.admit-team-player"),
    ...base,
    editionId: id,
    playerId: id,
    teamId: id,
  }),
  z.strictObject({
    action: z.literal("pool.pairing"),
    ...base,
    editionId: id,
    enabled: z.boolean(),
    playerId: id,
  }),
  z.strictObject({
    action: z.literal("pending.review"),
    ...base,
    decision: z.enum(["APPROVE", "REJECT"]),
    pendingChangeId: id,
  }),
  z.strictObject({ action: z.literal("ranking-source.approve"), ...base, snapshotId: id }),
  z.strictObject({ action: z.literal("vote.revoke"), ...base, voteId: id }),
]);

interface Dependencies {
  database: AppDatabase;
  env: AppEnv;
  onUnexpectedError?(error: unknown): void;
  pool: CandidatePoolService;
  sessions: Pick<AdminSessionService, "authenticate">;
}

export function createAdminMutationHandler(dependencies: Dependencies) {
  return async function adminMutationHandler(request: NextRequest): Promise<Response> {
    const rejected = guardAdminMutation(request, dependencies.env);
    if (rejected) return rejected;
    const session = await authenticateAdminRequest(
      request,
      dependencies.env,
      dependencies.sessions,
    );
    if (!session) return adminErrorResponse("ADMIN_AUTH_REQUIRED", "Admin login required", 401);

    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return adminErrorResponse("INVALID_ADMIN_JSON", "Request body must be valid JSON", 400);
      }
      const mutation = mutationSchema.parse(body);
      const actorAdminUserId = session.adminUserId;
      let result: unknown;
      switch (mutation.action) {
        case "team.create":
          result = await createTeam(dependencies.database, { ...mutation, actorAdminUserId });
          break;
        case "team.update":
          result = await updateTeam(dependencies.database, { ...mutation, actorAdminUserId });
          break;
        case "player.create":
          result = await createPlayer(dependencies.database, { ...mutation, actorAdminUserId });
          break;
        case "player.update":
          result = await updatePlayer(dependencies.database, { ...mutation, actorAdminUserId });
          dependencies.pool.invalidateAllActivePlayerIds();
          break;
        case "team.identity.upsert":
          result = await upsertTeamExternalIdentity(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "player.identity.upsert":
          result = await upsertPlayerExternalIdentity(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "roster.add":
          result = await addRosterMembership(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "roster.end":
          result = await endRosterMembership(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "edition.create":
          result = await createEdition(dependencies.database, { ...mutation, actorAdminUserId });
          break;
        case "edition.transition":
          if (mutation.status === "ACTIVE") {
            const readiness = await checkLaunchReadiness(dependencies.database, {
              editionId: mutation.editionId,
              expectedRiskMode: dependencies.env.RISK_ENFORCEMENT_MODE,
              sourceMaxAgeDays: dependencies.env.EXTERNAL_SOURCE_MAX_AGE_DAYS,
            });
            const blockers = readiness.checks
              .filter((item) => item.status === "BLOCK")
              .map((item) => item.code);
            if (blockers.length > 0) {
              throw new DomainError(
                "EDITION_ACTIVATION_BLOCKED",
                `Edition activation is blocked by: ${blockers.join(", ")}`,
                { blockers },
              );
            }
          }
          result = await transitionEdition(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "event.create":
          result = await createEvent(dependencies.database, { ...mutation, actorAdminUserId });
          break;
        case "event.whitelist":
          result = await setEventWhitelist(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "event.result":
          result = await recordEventTeamResult(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "pool.admit-team":
          result = await dependencies.pool.admitManualTeam({ ...mutation, actorAdminUserId });
          break;
        case "pool.admit-player":
          result = await dependencies.pool.admitSpecialPlayer({ ...mutation, actorAdminUserId });
          break;
        case "pool.admit-team-player":
          result = await dependencies.pool.admitTeamPlayer({ ...mutation, actorAdminUserId });
          break;
        case "pool.pairing":
          result = await dependencies.pool.setPairingEnabled({ ...mutation, actorAdminUserId });
          break;
        case "pending.review":
          result = await new PendingImportReviewService(
            dependencies.database,
            dependencies.pool,
          ).review({
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "ranking-source.approve":
          result = await approveRankingSourceSnapshot(dependencies.database, {
            ...mutation,
            actorAdminUserId,
          });
          break;
        case "vote.revoke":
          result = await new VoteModerationService(dependencies.database).revoke({
            ...mutation,
            actorAdminUserId,
          });
          break;
      }

      return NextResponse.json(
        { data: toAuditRecord((result ?? {}) as object) },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      return handleAdminError(error, dependencies.onUnexpectedError);
    }
  };
}
