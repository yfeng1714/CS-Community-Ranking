import "server-only";

import { desc } from "drizzle-orm";

import {
  adminAuditLogs,
  adminUsers,
  editions,
  events,
  moderationAuditLogs,
  pendingImportChanges,
  players,
  poolChangeLogs,
  poolPlayerEntries,
  poolTeamEntries,
  rosterMemberships,
  syncRuns,
  teams,
  votes,
} from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { checkScoreIntegrity } from "../votes/integrity.ts";

const iso = (value: Date | null) => value?.toISOString() ?? null;

export async function getAdminConsoleData(database: AppDatabase) {
  const [
    teamRows,
    playerRows,
    rosterRows,
    editionRows,
    eventRows,
    poolTeamRows,
    poolPlayerRows,
    pendingRows,
    voteRows,
    auditRows,
    poolLogRows,
    moderationRows,
    syncRows,
    adminRows,
  ] = await Promise.all([
    database.select().from(teams).orderBy(teams.name),
    database.select().from(players).orderBy(players.nickname),
    database.select().from(rosterMemberships).orderBy(desc(rosterMemberships.startsAt)),
    database.select().from(editions).orderBy(desc(editions.code)),
    database.select().from(events).orderBy(desc(events.startsAt)),
    database.select().from(poolTeamEntries).orderBy(desc(poolTeamEntries.admittedAt)),
    database.select().from(poolPlayerEntries).orderBy(desc(poolPlayerEntries.admittedAt)),
    database
      .select()
      .from(pendingImportChanges)
      .orderBy(desc(pendingImportChanges.createdAt))
      .limit(100),
    database.select().from(votes).orderBy(desc(votes.createdAt)).limit(100),
    database.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(100),
    database.select().from(poolChangeLogs).orderBy(desc(poolChangeLogs.createdAt)).limit(100),
    database
      .select()
      .from(moderationAuditLogs)
      .orderBy(desc(moderationAuditLogs.createdAt))
      .limit(100),
    database.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(50),
    database.select({ id: adminUsers.id, username: adminUsers.username }).from(adminUsers),
  ]);

  const teamNames = new Map(teamRows.map((row) => [row.id, row.name]));
  const playerNames = new Map(playerRows.map((row) => [row.id, row.nickname]));
  const editionCodes = new Map(editionRows.map((row) => [row.id, row.code]));
  const adminNames = new Map(adminRows.map((row) => [row.id, row.username]));
  const activeEdition = editionRows.find((row) => row.status === "ACTIVE") ?? null;
  const integrity = activeEdition ? await checkScoreIntegrity(database, activeEdition.id) : null;

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
      pendingChanges: pendingRows.filter((row) => row.status === "PENDING").length,
      poolPlayers: activeEdition
        ? poolPlayerRows.filter((row) => row.editionId === activeEdition.id).length
        : 0,
      poolTeams: activeEdition
        ? poolTeamRows.filter((row) => row.editionId === activeEdition.id).length
        : 0,
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
      id: row.id.toString(),
      nickname: row.nickname,
      photoPath: row.photoPath,
      professionalStatus: row.professionalStatus,
      realName: row.realName,
      slug: row.slug,
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
      createdAt: row.createdAt.toISOString(),
      editionCode: editionCodes.get(row.editionId) ?? "?",
      id: row.id.toString(),
      reason: row.reason,
      target: `${row.targetType} ${row.targetId}`,
    })),
    moderationLogs: moderationRows.map((row) => ({
      action: row.action,
      actor: adminNames.get(row.actorAdminUserId) ?? `Admin ${row.actorAdminUserId}`,
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
      startedAt: row.startedAt.toISOString(),
      status: row.status,
    })),
  };
}

export type AdminConsoleData = Awaited<ReturnType<typeof getAdminConsoleData>>;
