import { and, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import {
  editions,
  events,
  eventTeamResults,
  pendingImportChanges,
  poolTeamEntries,
  rankingSourceSnapshots,
  rosterMemberships,
  syncRuns,
  teamExternalIdentities,
  teams,
  players,
} from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue } from "../error.ts";
import { evaluateAutomaticTeamAdmission } from "../pool/rules.ts";
import { normalizedRankingSnapshotSchema, type NormalizedTeamRanking } from "./types.ts";
import { runRecordedSync } from "./sync-runs.ts";

export const POOL_DRAFT_JOB_NAME = "build-pool-draft";
const normalizeName = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("en");

export function classifyPoolDraftRosterEvidence(
  provider: "HLTV" | "VALVE_VRS",
  sourceRoster: readonly string[],
  currentRoster: readonly string[],
): { conflicts: string[]; warnings: string[] } {
  const normalizedCurrentRoster = new Set(currentRoster.map(normalizeName));
  const issue =
    sourceRoster.length !== 5
      ? `${provider}_ROSTER_INCOMPLETE`
      : sourceRoster.some((nickname) => !normalizedCurrentRoster.has(normalizeName(nickname)))
        ? `${provider}_ROSTER_MISMATCH`
        : null;
  if (!issue) return { conflicts: [], warnings: [] };
  if (provider === "VALVE_VRS") {
    return {
      conflicts: [],
      warnings: [issue, ...(issue.endsWith("_MISMATCH") ? ["HLTV_ROSTER_AUTHORITY_APPLIED"] : [])],
    };
  }
  return { conflicts: [issue], warnings: [] };
}

interface SourceTeam extends NormalizedTeamRanking {
  provider: "HLTV" | "VALVE_VRS";
}

export interface PoolDraftReport {
  conflicts: Array<{ codes: string[]; provider: string; sourceTeam: string }>;
  existing: string[];
  pendingIds: bigint[];
  proposed: string[];
  sourceFreshness: Record<string, string>;
  warnings: Array<{ codes: string[]; provider: string; sourceTeam: string }>;
  wouldRemove: string[];
}

export async function buildCandidatePoolDraft(
  database: AppDatabase,
  input: { editionCode: string; maxSourceAgeDays: number; now?: Date },
): Promise<PoolDraftReport> {
  const now = input.now ?? new Date();
  if (!Number.isInteger(input.maxSourceAgeDays) || input.maxSourceAgeDays <= 0) {
    throw new DomainError("INVALID_SOURCE_MAX_AGE", "Source maximum age must be positive days");
  }
  const [edition] = await database
    .select()
    .from(editions)
    .where(eq(editions.code, input.editionCode))
    .limit(1);
  const currentEdition = requireDomainValue(
    edition,
    "EDITION_NOT_FOUND",
    `Edition ${input.editionCode} does not exist`,
  );
  if (currentEdition.status !== "DRAFT" && currentEdition.status !== "ACTIVE") {
    throw new DomainError("EDITION_NOT_MUTABLE", "Pool drafts require a Draft or Active Edition");
  }
  const editionYear = Number(currentEdition.code);

  return runRecordedSync(database, {
    jobName: POOL_DRAFT_JOB_NAME,
    metadata: { editionCode: currentEdition.code, maxSourceAgeDays: input.maxSourceAgeDays },
    provider: "INTERNAL",
    operation: async (runId) => {
      const sourceRows = await Promise.all(
        (["HLTV", "VALVE_VRS"] as const).map(async (provider) => {
          const [row] = await database
            .select()
            .from(rankingSourceSnapshots)
            .where(
              and(
                eq(rankingSourceSnapshots.provider, provider),
                isNotNull(rankingSourceSnapshots.approvedAt),
              ),
            )
            .orderBy(
              desc(rankingSourceSnapshots.publishedAt),
              desc(rankingSourceSnapshots.capturedAt),
            )
            .limit(1);
          return [provider, row] as const;
        }),
      );
      const missing = sourceRows.filter(([, row]) => !row).map(([provider]) => provider);
      if (missing.length) {
        throw new DomainError(
          "APPROVED_RANKING_SOURCE_MISSING",
          `Approved snapshots missing: ${missing.join(", ")}`,
        );
      }
      const sourceFreshness: Record<string, string> = {};
      const sourceTeams: SourceTeam[] = [];
      const staleProviders = new Set<string>();
      for (const [provider, rowOrUndefined] of sourceRows) {
        const row = rowOrUndefined!;
        const parsed = normalizedRankingSnapshotSchema.safeParse(row.normalizedData);
        if (!parsed.success)
          throw new DomainError(
            "APPROVED_RANKING_SOURCE_INVALID",
            `${provider} approved snapshot is invalid`,
          );
        const publishedAt = new Date(parsed.data.publishedAt);
        sourceFreshness[provider] = publishedAt.toISOString();
        if (now.getTime() - publishedAt.getTime() > input.maxSourceAgeDays * 86_400_000)
          staleProviders.add(provider);
        sourceTeams.push(
          ...parsed.data.teams
            .filter((team) => team.rank <= 20)
            .map((team) => ({ ...team, provider })),
        );
      }

      const [teamRows, identityRows, currentRosterRows, poolRows, resultRows] = await Promise.all([
        database.select().from(teams).where(eq(teams.active, true)),
        database
          .select()
          .from(teamExternalIdentities)
          .where(eq(teamExternalIdentities.provider, "HLTV")),
        database
          .select({ nickname: players.nickname, teamId: rosterMemberships.teamId })
          .from(rosterMemberships)
          .innerJoin(players, eq(players.id, rosterMemberships.playerId))
          .where(
            and(
              eq(rosterMemberships.status, "STARTER"),
              isNull(rosterMemberships.endsAt),
              eq(players.professionalStatus, "ACTIVE"),
            ),
          ),
        database
          .select()
          .from(poolTeamEntries)
          .where(eq(poolTeamEntries.editionId, currentEdition.id)),
        database
          .select({
            eventEndsAt: events.endsAt,
            eventName: events.name,
            isMajor: events.isMajor,
            isT1Whitelisted: events.isT1Whitelisted,
            placementFrom: eventTeamResults.placementFrom,
            placementTo: eventTeamResults.placementTo,
            teamId: eventTeamResults.teamId,
          })
          .from(eventTeamResults)
          .innerJoin(events, eq(events.id, eventTeamResults.eventId)),
      ]);
      const teamsByName = new Map<string, typeof teamRows>();
      for (const team of teamRows)
        teamsByName.set(normalizeName(team.name), [
          ...(teamsByName.get(normalizeName(team.name)) ?? []),
          team,
        ]);
      const hltvIdentity = new Map(
        identityRows.map((identity) => [identity.externalId, identity.teamId]),
      );
      const teamById = new Map(teamRows.map((team) => [team.id, team]));
      const rosterByTeam = new Map<bigint, string[]>();
      for (const row of currentRosterRows)
        rosterByTeam.set(row.teamId, [...(rosterByTeam.get(row.teamId) ?? []), row.nickname]);
      const grouped = new Map<
        bigint,
        { hltvRank?: number; sourceTeams: SourceTeam[]; vrsRank?: number }
      >();
      const conflicts: PoolDraftReport["conflicts"] = [];
      const warnings: PoolDraftReport["warnings"] = [];
      for (const sourceTeam of sourceTeams) {
        const identityTeamId =
          sourceTeam.provider === "HLTV" && sourceTeam.externalId
            ? hltvIdentity.get(sourceTeam.externalId)
            : undefined;
        const nameMatches = teamsByName.get(normalizeName(sourceTeam.name)) ?? [];
        const matched = identityTeamId
          ? teamById.get(identityTeamId)
          : nameMatches.length === 1
            ? nameMatches[0]
            : undefined;
        if (!matched) {
          const issue = {
            codes: [
              nameMatches.length > 1
                ? "AMBIGUOUS_TEAM_IDENTITY"
                : sourceTeam.rank <= 12
                  ? "TEAM_IDENTITY_MISSING"
                  : "TOP20_TEAM_NOT_IMPORTED_NO_EVENT_EVIDENCE",
            ],
            provider: sourceTeam.provider,
            sourceTeam: sourceTeam.name,
          };
          if (sourceTeam.rank <= 12) conflicts.push(issue);
          else warnings.push(issue);
          continue;
        }
        const record = grouped.get(matched.id) ?? { sourceTeams: [] };
        record.sourceTeams.push(sourceTeam);
        if (sourceTeam.provider === "HLTV") record.hltvRank = sourceTeam.rank;
        else record.vrsRank = sourceTeam.rank;
        grouped.set(matched.id, record);
      }

      const pendingIds: bigint[] = [];
      const proposed: string[] = [];
      const existing: string[] = [];
      const wouldRemove = new Set<string>();
      await database.transaction(async (transaction) => {
        await transaction
          .update(pendingImportChanges)
          .set({ status: "SUPERSEDED" })
          .where(
            and(
              eq(pendingImportChanges.status, "PENDING"),
              eq(pendingImportChanges.editionId, currentEdition.id),
              inArray(
                pendingImportChanges.syncRunId,
                database
                  .select({ id: syncRuns.id })
                  .from(syncRuns)
                  .where(
                    and(
                      eq(syncRuns.jobName, POOL_DRAFT_JOB_NAME),
                      eq(syncRuns.provider, "INTERNAL"),
                      lt(syncRuns.id, runId),
                    ),
                  ),
              ),
            ),
          );

        for (const [teamId, ranking] of grouped) {
          const team = teamById.get(teamId)!;
          const currentRoster = rosterByTeam.get(teamId) ?? [];
          const conflictCodes: string[] = [];
          if (currentRoster.length !== 5) conflictCodes.push("FORMAL_STARTING_FIVE_INVALID");
          for (const sourceTeam of ranking.sourceTeams) {
            if (staleProviders.has(sourceTeam.provider))
              conflictCodes.push(`${sourceTeam.provider}_SOURCE_STALE`);
            const rosterEvidence = classifyPoolDraftRosterEvidence(
              sourceTeam.provider,
              sourceTeam.roster,
              currentRoster,
            );
            conflictCodes.push(...rosterEvidence.conflicts);
            if (rosterEvidence.warnings.length) {
              warnings.push({
                codes: rosterEvidence.warnings,
                provider: sourceTeam.provider,
                sourceTeam: team.name,
              });
            }
          }
          const eventResults = resultRows.filter((row) => row.teamId === teamId);
          const evidence = {
            editionYear,
            eventResults,
            hltvRank: ranking.hltvRank ?? null,
            vrsRank: ranking.vrsRank ?? null,
          };
          const evaluation = evaluateAutomaticTeamAdmission(evidence);
          const existingEntry = poolRows.find((row) => row.teamId === teamId);
          if (existingEntry) {
            if (existingEntry.admissionType === "REVIEW_MANUAL" || evaluation.eligible)
              existing.push(team.name);
            else wouldRemove.add(team.name);
            continue;
          }
          if (!evaluation.eligible) continue;
          const [pending] = await transaction
            .insert(pendingImportChanges)
            .values({
              changeType: "POOL_TEAM",
              conflictCodes: [...new Set(conflictCodes)],
              editionId: currentEdition.id,
              proposedData: {
                action: "pool.admit-team",
                expectedState: null,
                input: {
                  editionId: currentEdition.id.toString(),
                  evidence,
                  teamId: teamId.toString(),
                },
                version: 1,
              },
              syncRunId: runId,
              targetExternalKey: `team:${teamId}`,
            })
            .returning({ id: pendingImportChanges.id });
          if (pending) {
            pendingIds.push(pending.id);
            proposed.push(team.name);
          }
        }
      });
      for (const entry of poolRows) {
        if (entry.admissionType !== "REVIEW_MANUAL" && !grouped.has(entry.teamId)) {
          const team = teamById.get(entry.teamId);
          if (team) wouldRemove.add(team.name);
        }
      }
      const freshest = Object.values(sourceFreshness).map((value) => new Date(value).getTime());
      const report = {
        conflicts,
        existing,
        pendingIds,
        proposed,
        sourceFreshness,
        warnings,
        wouldRemove: [...wouldRemove],
      };
      return {
        metadata: {
          conflictCount: conflicts.length,
          existing,
          pendingIds: pendingIds.map(String),
          proposed,
          sourceFreshness,
          warningCount: warnings.length,
          warnings,
          wouldRemove: [...wouldRemove],
        },
        recordsChanged: pendingIds.length,
        recordsSeen: grouped.size + conflicts.length,
        sourceFreshnessAt: new Date(Math.min(...freshest)),
        status:
          conflicts.length || staleProviders.size ? ("PARTIAL" as const) : ("SUCCEEDED" as const),
        value: report,
      };
    },
  });
}
