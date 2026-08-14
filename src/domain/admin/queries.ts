import "server-only";

import { count, desc, eq } from "drizzle-orm";

import {
  adminAuditLogs,
  adminUsers,
  editions,
  eventTeamResults,
  events,
  moderationAuditLogs,
  pendingImportChanges,
  playerExternalIdentities,
  players,
  poolChangeLogs,
  poolPlayerEntries,
  poolTeamEntries,
  rankingSourceSnapshots,
  rosterMemberships,
  syncRuns,
  teamExternalIdentities,
  teams,
  votes,
} from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { checkScoreIntegrity } from "../votes/integrity.ts";
import { summarizePoolUpdateStatus } from "./pool-update-status.ts";

const iso = (value: Date | null) => value?.toISOString() ?? null;

export async function getAdminConsoleData(
  database: AppDatabase,
  options: { voteId?: string } = {},
) {
  const voteSearch = options.voteId?.trim() ?? "";
  const parsedVoteId = /^[1-9]\d{0,18}$/.test(voteSearch) ? BigInt(voteSearch) : null;
  const validVoteSearch =
    voteSearch === "" || (parsedVoteId !== null && parsedVoteId <= 9_223_372_036_854_775_807n);
  const voteRowsPromise = !validVoteSearch
    ? Promise.resolve([])
    : voteSearch
      ? database.select().from(votes).where(eq(votes.id, parsedVoteId!)).limit(1)
      : database.select().from(votes).orderBy(desc(votes.createdAt)).limit(100);
  const [
    teamRows,
    playerRows,
    rosterRows,
    editionRows,
    eventRows,
    eventResultRows,
    poolTeamRows,
    poolPlayerRows,
    pendingRows,
    pendingCountRows,
    voteRows,
    auditRows,
    poolLogRows,
    moderationRows,
    syncRows,
    adminRows,
    playerIdentityRows,
    teamIdentityRows,
    rankingSnapshotRows,
  ] = await Promise.all([
    database.select().from(teams).orderBy(teams.name),
    database.select().from(players).orderBy(players.nickname),
    database.select().from(rosterMemberships).orderBy(desc(rosterMemberships.startsAt)),
    database.select().from(editions).orderBy(desc(editions.code)),
    database.select().from(events).orderBy(desc(events.startsAt)),
    database.select().from(eventTeamResults),
    database.select().from(poolTeamEntries).orderBy(desc(poolTeamEntries.admittedAt)),
    database.select().from(poolPlayerEntries).orderBy(desc(poolPlayerEntries.admittedAt)),
    database
      .select()
      .from(pendingImportChanges)
      .orderBy(desc(pendingImportChanges.createdAt))
      .limit(100),
    database
      .select({ value: count() })
      .from(pendingImportChanges)
      .where(eq(pendingImportChanges.status, "PENDING")),
    voteRowsPromise,
    database.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(100),
    database.select().from(poolChangeLogs).orderBy(desc(poolChangeLogs.createdAt)).limit(100),
    database
      .select()
      .from(moderationAuditLogs)
      .orderBy(desc(moderationAuditLogs.createdAt))
      .limit(100),
    database.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(50),
    database.select({ id: adminUsers.id, username: adminUsers.username }).from(adminUsers),
    database.select().from(playerExternalIdentities).orderBy(playerExternalIdentities.provider),
    database.select().from(teamExternalIdentities).orderBy(teamExternalIdentities.provider),
    database
      .select()
      .from(rankingSourceSnapshots)
      .orderBy(desc(rankingSourceSnapshots.capturedAt))
      .limit(50),
  ]);

  const teamNames = new Map(teamRows.map((row) => [row.id, row.name]));
  const playerNames = new Map(playerRows.map((row) => [row.id, row.nickname]));
  const editionCodes = new Map(editionRows.map((row) => [row.id, row.code]));
  const adminNames = new Map(adminRows.map((row) => [row.id, row.username]));
  const activeEdition = editionRows.find((row) => row.status === "ACTIVE") ?? null;
  const integrity = activeEdition ? await checkScoreIntegrity(database, activeEdition.id) : null;
  const poolUpdateStatus = summarizePoolUpdateStatus({
    draftRuns: syncRows
      .filter((row) => row.jobName === "build-pool-draft" && row.provider === "INTERNAL")
      .map((row) => ({
        finishedAt: row.finishedAt,
        id: row.id,
        startedAt: row.startedAt,
        status: row.status,
      })),
    proposals: pendingRows.map((row) => ({
      changeType: row.changeType,
      conflictCodes: row.conflictCodes,
      status: row.status,
    })),
    sources: rankingSnapshotRows.flatMap((row) => {
      if (row.provider !== "HLTV" && row.provider !== "VALVE_VRS") return [];
      const normalizedData = row.normalizedData;
      return [
        {
          approvedAt: row.approvedAt,
          capturedAt: row.capturedAt,
          id: row.id,
          parserVersion: row.parserVersion,
          provider: row.provider,
          publishedAt: row.publishedAt,
          recordCount:
            typeof normalizedData === "object" &&
            normalizedData !== null &&
            "teams" in normalizedData &&
            Array.isArray(normalizedData.teams)
              ? normalizedData.teams.length
              : null,
        },
      ];
    }),
  });

  return {
    dashboard: {
      activeEdition: activeEdition
        ? { code: activeEdition.code, id: activeEdition.id.toString(), name: activeEdition.name }
        : null,
      integrity,
      lastSync: syncRows[0]
        ? {
            finishedAt: iso(syncRows[0].finishedAt),
            jobName: syncRows[0].jobName,
            status: syncRows[0].status,
          }
        : null,
      pendingChanges: pendingCountRows[0]?.value ?? 0,
      poolPlayers: activeEdition
        ? poolPlayerRows.filter((row) => row.editionId === activeEdition.id).length
        : 0,
      poolTeams: activeEdition
        ? poolTeamRows.filter((row) => row.editionId === activeEdition.id).length
        : 0,
      poolUpdate: {
        ...poolUpdateStatus,
        latestDraft: poolUpdateStatus.latestDraft
          ? {
              finishedAt: iso(poolUpdateStatus.latestDraft.finishedAt),
              id: poolUpdateStatus.latestDraft.id.toString(),
              startedAt: poolUpdateStatus.latestDraft.startedAt.toISOString(),
              status: poolUpdateStatus.latestDraft.status,
            }
          : null,
        latestSources: poolUpdateStatus.latestSources.map((source) =>
          source
            ? {
                approvedAt: iso(source.approvedAt),
                capturedAt: source.capturedAt.toISOString(),
                id: source.id.toString(),
                parserVersion: source.parserVersion,
                provider: source.provider,
                publishedAt: iso(source.publishedAt),
                recordCount: source.recordCount,
              }
            : null,
        ),
      },
    },
    teams: teamRows.map((row) => ({
      active: row.active,
      countryCode: row.countryCode,
      id: row.id.toString(),
      logoPath: row.logoPath,
      name: row.name,
      shortName: row.shortName,
      slug: row.slug,
    })),
    players: playerRows.map((row) => ({
      countryCode: row.countryCode,
      hltvProfileUrl: row.hltvProfileUrl,
      id: row.id.toString(),
      nickname: row.nickname,
      photoPath: row.photoPath,
      professionalStatus: row.professionalStatus,
      realName: row.realName,
      slug: row.slug,
    })),
    playerIdentities: playerIdentityRows.map((row) => ({
      externalId: row.externalId,
      externalSlug: row.externalSlug,
      lastVerifiedAt: row.lastVerifiedAt.toISOString(),
      playerId: row.playerId.toString(),
      playerName: playerNames.get(row.playerId) ?? "Unknown player",
      provider: row.provider,
      sourceUrl: row.sourceUrl,
    })),
    teamIdentities: teamIdentityRows.map((row) => ({
      externalId: row.externalId,
      externalSlug: row.externalSlug,
      lastVerifiedAt: row.lastVerifiedAt.toISOString(),
      provider: row.provider,
      sourceUrl: row.sourceUrl,
      teamId: row.teamId.toString(),
      teamName: teamNames.get(row.teamId) ?? "Unknown team",
    })),
    rosters: rosterRows.map((row) => ({
      endsAt: row.endsAt,
      id: row.id.toString(),
      playerId: row.playerId.toString(),
      playerName: playerNames.get(row.playerId) ?? "Unknown player",
      source: row.source,
      startsAt: row.startsAt,
      status: row.status,
      teamId: row.teamId.toString(),
      teamName: teamNames.get(row.teamId) ?? "Unknown team",
    })),
    editions: editionRows.map((row) => ({
      ballotTtlMinutes: row.ballotTtlMinutes,
      code: row.code,
      endsAt: row.endsAt.toISOString(),
      fullWeightBallotsPerDay: row.fullWeightBallotsPerDay,
      id: row.id.toString(),
      name: row.name,
      startsAt: row.startsAt.toISOString(),
      status: row.status,
    })),
    events: eventRows.map((row) => ({
      endsAt: row.endsAt,
      id: row.id.toString(),
      isMajor: row.isMajor,
      isT1Whitelisted: row.isT1Whitelisted,
      name: row.name,
      slug: row.slug,
      startsAt: row.startsAt,
      whitelistNote: row.whitelistNote,
      whitelistReason: row.whitelistReason,
    })),
    eventResults: eventResultRows.map((row) => ({
      eventId: row.eventId.toString(),
      eventName: eventRows.find((event) => event.id === row.eventId)?.name ?? "Unknown event",
      placementFrom: row.placementFrom,
      placementTo: row.placementTo,
      teamId: row.teamId.toString(),
      teamName: teamNames.get(row.teamId) ?? "Unknown team",
    })),
    poolTeams: poolTeamRows.map((row) => ({
      admissionReason: row.admissionReason,
      admissionType: row.admissionType,
      editionCode: editionCodes.get(row.editionId) ?? "?",
      editionId: row.editionId.toString(),
      id: row.id.toString(),
      teamId: row.teamId.toString(),
      teamName: teamNames.get(row.teamId) ?? "Unknown team",
    })),
    poolPlayers: poolPlayerRows.map((row) => ({
      admissionReason: row.admissionReason,
      admissionType: row.admissionType,
      editionCode: editionCodes.get(row.editionId) ?? "?",
      editionId: row.editionId.toString(),
      id: row.id.toString(),
      pairingDisabledReason: row.pairingDisabledReason,
      pairingEnabled: row.pairingEnabled,
      playerId: row.playerId.toString(),
      playerName: playerNames.get(row.playerId) ?? "Unknown player",
    })),
    pendingImports: pendingRows.map((row) => ({
      changeType: row.changeType,
      conflictCodes: row.conflictCodes,
      createdAt: row.createdAt.toISOString(),
      id: row.id.toString(),
      proposedData: row.proposedData,
      reviewReason: row.reviewReason,
      status: row.status,
      targetExternalKey: row.targetExternalKey,
    })),
    votes: voteRows.map((row) => ({
      choice: row.choice,
      createdAt: row.createdAt.toISOString(),
      id: row.id.toString(),
      riskReasonCodes: row.riskReasonCodes,
      status: row.status,
    })),
    voteSearch: {
      invalid: !validVoteSearch,
      query: voteSearch,
      showingRecent: voteSearch === "",
    },
    auditLogs: auditRows.map((row) => ({
      action: row.action,
      actor: adminNames.get(row.actorAdminUserId) ?? `Admin ${row.actorAdminUserId}`,
      after: row.after,
      before: row.before,
      createdAt: row.createdAt.toISOString(),
      id: row.id.toString(),
      reason: row.reason,
      target: `${row.targetType} ${row.targetId}`,
    })),
    poolChangeLogs: poolLogRows.map((row) => ({
      action: row.action,
      actor: adminNames.get(row.actorAdminUserId) ?? `Admin ${row.actorAdminUserId}`,
      after: row.after,
      before: row.before,
      createdAt: row.createdAt.toISOString(),
      editionCode: editionCodes.get(row.editionId) ?? "?",
      id: row.id.toString(),
      reason: row.reason,
      target: `${row.targetType} ${row.targetId}`,
    })),
    moderationLogs: moderationRows.map((row) => ({
      action: row.action,
      actor: adminNames.get(row.actorAdminUserId) ?? `Admin ${row.actorAdminUserId}`,
      after: row.after,
      before: row.before,
      createdAt: row.createdAt.toISOString(),
      id: row.id.toString(),
      reason: row.reason,
      voteId: row.voteId.toString(),
    })),
    syncRuns: syncRows.map((row) => ({
      errorSummary: row.errorSummary,
      finishedAt: iso(row.finishedAt),
      id: row.id.toString(),
      jobName: row.jobName,
      metadata: row.metadata,
      provider: row.provider,
      recordsChanged: row.recordsChanged,
      recordsSeen: row.recordsSeen,
      sourceFreshnessAt: iso(row.sourceFreshnessAt),
      startedAt: row.startedAt.toISOString(),
      status: row.status,
    })),
    rankingSourceSnapshots: rankingSnapshotRows.map((row) => ({
      approvedAt: iso(row.approvedAt),
      capturedAt: row.capturedAt.toISOString(),
      id: row.id.toString(),
      parserVersion: row.parserVersion,
      provider: row.provider,
      publishedAt: iso(row.publishedAt),
      rawChecksum: row.rawChecksum,
      normalizedData: row.normalizedData,
      sourceUrl:
        typeof row.normalizedData === "object" &&
        row.normalizedData !== null &&
        "sourceUrl" in row.normalizedData &&
        typeof row.normalizedData.sourceUrl === "string"
          ? row.normalizedData.sourceUrl
          : null,
      recordCount:
        typeof row.normalizedData === "object" &&
        row.normalizedData !== null &&
        "teams" in row.normalizedData &&
        Array.isArray(row.normalizedData.teams)
          ? row.normalizedData.teams.length
          : null,
    })),
  };
}

export type AdminConsoleData = Awaited<ReturnType<typeof getAdminConsoleData>>;
