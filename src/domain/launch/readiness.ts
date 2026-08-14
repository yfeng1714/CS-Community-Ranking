import { and, eq, isNotNull, isNull } from "drizzle-orm";

import {
  editions,
  pendingImportChanges,
  playerExternalIdentities,
  playerRankings,
  playerStatSnapshots,
  players,
  poolChangeLogs,
  poolPlayerEntries,
  poolTeamEntries,
  rosterMemberships,
  rankingSourceSnapshots,
  syncRuns,
  teamExternalIdentities,
  teams,
} from "@/db/schema";
import { loadAssetRegistry } from "@/domain/assets/attribution";
import type { AppDatabase } from "@/domain/database";
import { DomainError, requireDomainValue } from "@/domain/error";
import { runIntegrityCheck } from "@/domain/integrity/check";

export type LaunchReadinessCheckStatus = "BLOCK" | "PASS" | "WARN";

export interface LaunchReadinessCheck {
  code: string;
  details: Record<string, unknown>;
  message: string;
  status: LaunchReadinessCheckStatus;
}

export interface LaunchReadinessReport {
  blocking: boolean;
  checkedAt: string;
  checks: LaunchReadinessCheck[];
  edition: {
    code: string;
    fullWeightBallotsPerDay: number;
    id: string;
    name: string;
    status: "DRAFT" | "ACTIVE" | "FROZEN" | "ARCHIVED";
  };
  pool: {
    activePairingPlayers: number;
    admissionCounts: Record<"CORE" | "REVIEW_AUTO" | "REVIEW_MANUAL" | "SPECIAL", number>;
    pairCount: string;
    players: number;
    teams: number;
  };
  warnings: number;
}

export type LaunchReadinessInput = {
  expectedRiskMode: "enforce" | "observe";
  now?: Date;
  rootDirectory?: string;
  sourceMaxAgeDays: number;
} & ({ editionCode: string; editionId?: never } | { editionCode?: never; editionId: bigint });

function check(
  status: LaunchReadinessCheckStatus,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): LaunchReadinessCheck {
  return { code, details, message, status };
}

function pairCount(playersCount: number): string {
  return ((BigInt(playersCount) * BigInt(Math.max(0, playersCount - 1))) / 2n).toString();
}

export async function checkLaunchReadiness(
  database: AppDatabase,
  input: LaunchReadinessInput,
): Promise<LaunchReadinessReport> {
  const now = input.now ?? new Date();
  if (!Number.isInteger(input.sourceMaxAgeDays) || input.sourceMaxAgeDays <= 0) {
    throw new DomainError(
      "INVALID_SOURCE_MAX_AGE",
      "Launch source maximum age must be positive days",
    );
  }
  const [edition] = await database
    .select()
    .from(editions)
    .where(
      input.editionId === undefined
        ? eq(editions.code, input.editionCode)
        : eq(editions.id, input.editionId),
    )
    .limit(1);
  const currentEdition = requireDomainValue(
    edition,
    "EDITION_NOT_FOUND",
    `Edition ${input.editionId?.toString() ?? input.editionCode} does not exist`,
  );

  const [
    teamRows,
    playerRows,
    currentStarterRows,
    rankingRows,
    pendingRows,
    poolLogRows,
    sourceRows,
    latestPoolDraftRows,
    teamIdentityRows,
    playerIdentityRows,
    statPlayerRows,
  ] = await Promise.all([
    database
      .select({
        admissionType: poolTeamEntries.admissionType,
        active: teams.active,
        id: poolTeamEntries.id,
        logoPath: teams.logoPath,
        name: teams.name,
        teamId: teams.id,
      })
      .from(poolTeamEntries)
      .innerJoin(teams, eq(teams.id, poolTeamEntries.teamId))
      .where(eq(poolTeamEntries.editionId, currentEdition.id)),
    database
      .select({
        admissionType: poolPlayerEntries.admissionType,
        id: poolPlayerEntries.id,
        nickname: players.nickname,
        pairingEnabled: poolPlayerEntries.pairingEnabled,
        photoPath: players.photoPath,
        playerId: players.id,
        professionalStatus: players.professionalStatus,
        sourceTeamEntryId: poolPlayerEntries.sourceTeamEntryId,
      })
      .from(poolPlayerEntries)
      .innerJoin(players, eq(players.id, poolPlayerEntries.playerId))
      .where(eq(poolPlayerEntries.editionId, currentEdition.id)),
    database
      .select({
        playerId: rosterMemberships.playerId,
        sourceTeamEntryId: poolPlayerEntries.sourceTeamEntryId,
        teamId: rosterMemberships.teamId,
      })
      .from(poolPlayerEntries)
      .innerJoin(poolTeamEntries, eq(poolTeamEntries.id, poolPlayerEntries.sourceTeamEntryId))
      .innerJoin(
        rosterMemberships,
        and(
          eq(rosterMemberships.playerId, poolPlayerEntries.playerId),
          eq(rosterMemberships.teamId, poolTeamEntries.teamId),
        ),
      )
      .where(
        and(
          eq(poolPlayerEntries.editionId, currentEdition.id),
          isNotNull(poolPlayerEntries.sourceTeamEntryId),
          eq(rosterMemberships.status, "STARTER"),
          isNull(rosterMemberships.endsAt),
        ),
      ),
    database
      .select({
        losses: playerRankings.losses,
        playerId: playerRankings.playerId,
        score: playerRankings.score,
        skips: playerRankings.skips,
        wins: playerRankings.wins,
      })
      .from(playerRankings)
      .where(eq(playerRankings.editionId, currentEdition.id)),
    database
      .select({
        changeType: pendingImportChanges.changeType,
        conflictCodes: pendingImportChanges.conflictCodes,
        id: pendingImportChanges.id,
        status: pendingImportChanges.status,
        targetExternalKey: pendingImportChanges.targetExternalKey,
      })
      .from(pendingImportChanges)
      .where(
        and(
          eq(pendingImportChanges.editionId, currentEdition.id),
          eq(pendingImportChanges.status, "PENDING"),
        ),
      ),
    database
      .select({
        action: poolChangeLogs.action,
        targetId: poolChangeLogs.targetId,
        targetType: poolChangeLogs.targetType,
      })
      .from(poolChangeLogs)
      .where(eq(poolChangeLogs.editionId, currentEdition.id)),
    database
      .select({
        approvedAt: rankingSourceSnapshots.approvedAt,
        capturedAt: rankingSourceSnapshots.capturedAt,
        provider: rankingSourceSnapshots.provider,
        publishedAt: rankingSourceSnapshots.publishedAt,
      })
      .from(rankingSourceSnapshots)
      .where(isNotNull(rankingSourceSnapshots.approvedAt)),
    database
      .select({
        id: syncRuns.id,
        metadata: syncRuns.metadata,
        sourceFreshnessAt: syncRuns.sourceFreshnessAt,
        status: syncRuns.status,
      })
      .from(syncRuns)
      .where(and(eq(syncRuns.jobName, "build-pool-draft"), eq(syncRuns.provider, "INTERNAL")))
      .orderBy(syncRuns.id),
    database
      .select({ teamId: teamExternalIdentities.teamId })
      .from(teamExternalIdentities)
      .where(eq(teamExternalIdentities.provider, "HLTV")),
    database
      .select({ playerId: playerExternalIdentities.playerId })
      .from(playerExternalIdentities)
      .where(eq(playerExternalIdentities.provider, "HLTV")),
    database
      .selectDistinct({ playerId: playerStatSnapshots.playerId })
      .from(playerStatSnapshots)
      .where(eq(playerStatSnapshots.provider, "HLTV")),
  ]);

  const hltvTeamIds = new Set(teamIdentityRows.map((row) => row.teamId));
  const hltvPlayerIds = new Set(playerIdentityRows.map((row) => row.playerId));
  const statPlayerIds = new Set(statPlayerRows.map((row) => row.playerId));
  const currentStarterKeys = new Set(
    currentStarterRows.map((row) => `${row.sourceTeamEntryId}:${row.playerId}`),
  );
  const assetRegistry = await loadAssetRegistry(input.rootDirectory);
  const attributedAssets = new Set(assetRegistry.assets.map((entry) => entry.assetPath));
  const configuredPoolAssets = new Set([
    ...teamRows.flatMap((row) => (row.logoPath ? [row.logoPath] : [])),
    ...playerRows.flatMap((row) => (row.photoPath ? [row.photoPath] : [])),
  ]);
  const pendingRightsAssets = assetRegistry.assets
    .filter(
      (entry) =>
        entry.permission === "OWNER_ACCEPTED_PENDING_RIGHTS" &&
        configuredPoolAssets.has(entry.assetPath),
    )
    .map((entry) => entry.assetPath);
  const latestApprovedSources = new Map<"HLTV" | "VALVE_VRS", (typeof sourceRows)[number]>();
  for (const row of sourceRows) {
    if (row.provider !== "HLTV" && row.provider !== "VALVE_VRS") continue;
    const current = latestApprovedSources.get(row.provider);
    const rowDate = row.publishedAt ?? row.capturedAt;
    const currentDate = current ? (current.publishedAt ?? current.capturedAt) : null;
    if (!currentDate || rowDate > currentDate) latestApprovedSources.set(row.provider, row);
  }
  const latestPoolDraft = [...latestPoolDraftRows]
    .reverse()
    .find((row) => row.metadata.editionCode === currentEdition.code);
  const requiredProviders = ["HLTV", "VALVE_VRS"] as const;
  const missingSources = requiredProviders.filter(
    (provider) => !latestApprovedSources.has(provider),
  );
  const staleSources = requiredProviders.filter((provider) => {
    const source = latestApprovedSources.get(provider);
    if (!source) return false;
    const publishedAt = source.publishedAt ?? source.capturedAt;
    return now.getTime() - publishedAt.getTime() > input.sourceMaxAgeDays * 86_400_000;
  });
  const draftSourceFreshness: Record<string, unknown> =
    latestPoolDraft?.metadata.sourceFreshness &&
    typeof latestPoolDraft.metadata.sourceFreshness === "object" &&
    !Array.isArray(latestPoolDraft.metadata.sourceFreshness)
      ? (latestPoolDraft.metadata.sourceFreshness as Record<string, unknown>)
      : {};
  const draftUsesOlderSource = requiredProviders.filter((provider) => {
    const source = latestApprovedSources.get(provider);
    if (!source) return false;
    return (
      draftSourceFreshness[provider] !== (source.publishedAt ?? source.capturedAt).toISOString()
    );
  });

  const activePairingRows = playerRows.filter(
    (row) => row.pairingEnabled && row.professionalStatus === "ACTIVE",
  );
  const inactiveTeams = teamRows.filter((row) => !row.active);
  const ineligiblePairingPlayers = playerRows.filter(
    (row) => row.pairingEnabled && row.professionalStatus !== "ACTIVE",
  );
  const teamDerivedRosterConflicts = playerRows.filter(
    (row) =>
      row.pairingEnabled &&
      row.sourceTeamEntryId !== null &&
      !currentStarterKeys.has(`${row.sourceTeamEntryId}:${row.playerId}`),
  );
  const missingRankingPlayers = playerRows.filter(
    (row) => !rankingRows.some((ranking) => ranking.playerId === row.playerId),
  );
  const nonzeroRankings = rankingRows.filter(
    (row) => row.score !== 0 || row.wins !== 0n || row.losses !== 0n || row.skips !== 0n,
  );
  const unresolvedImports = pendingRows;
  const missingTeamIdentities = teamRows.filter((row) => !hltvTeamIds.has(row.teamId));
  const missingPlayerIdentities = playerRows.filter((row) => !hltvPlayerIds.has(row.playerId));
  const missingPhotos = playerRows.filter((row) => row.photoPath === null);
  const unattributedPhotos = playerRows.filter(
    (row) => row.photoPath !== null && !attributedAssets.has(row.photoPath),
  );
  const teamsWithoutLogos = teamRows.filter((row) => row.logoPath === null);
  const unattributedLogos = teamRows.filter(
    (row) => row.logoPath !== null && !attributedAssets.has(row.logoPath),
  );
  const missingStats = playerRows.filter((row) => !statPlayerIds.has(row.playerId));
  const admittedTeamLogIds = new Set(
    poolLogRows
      .filter((row) => row.targetType === "POOL_TEAM" && row.action === "ADMIT_TEAM")
      .map((row) => row.targetId),
  );
  const admittedPlayerLogIds = new Set(
    poolLogRows
      .filter(
        (row) =>
          row.targetType === "POOL_PLAYER" &&
          (row.action === "ADMIT_TEAM_PLAYER" || row.action === "ADMIT_SPECIAL_PLAYER"),
      )
      .map((row) => row.targetId),
  );
  const unauditedTeams = teamRows.filter((row) => !admittedTeamLogIds.has(row.id.toString()));
  const unauditedPlayers = playerRows.filter((row) => !admittedPlayerLogIds.has(row.id.toString()));

  const integrity = await runIntegrityCheck(database, {
    editionCode: currentEdition.code,
    now,
  });
  const checks: LaunchReadinessCheck[] = [
    check(
      currentEdition.status === "DRAFT" ? "PASS" : "BLOCK",
      "EDITION_REQUIRES_DRAFT_REVIEW",
      currentEdition.status === "DRAFT"
        ? "Edition is still DRAFT; activation remains an explicit owner action."
        : `Edition is ${currentEdition.status}; the pre-activation report must run while it is DRAFT.`,
      { status: currentEdition.status },
    ),
    check(
      teamRows.length > 0 ? "PASS" : "BLOCK",
      "POOL_TEAMS_PRESENT",
      teamRows.length > 0 ? "Pool contains admitted teams." : "Pool contains no admitted teams.",
      { teams: teamRows.length },
    ),
    check(
      activePairingRows.length >= 2 ? "PASS" : "BLOCK",
      "PAIRING_POOL_READY",
      activePairingRows.length >= 2
        ? "At least two active players are pairing-enabled."
        : "At least two active pairing-enabled players are required.",
      { activePairingPlayers: activePairingRows.length },
    ),
    check(
      inactiveTeams.length === 0 && ineligiblePairingPlayers.length === 0 ? "PASS" : "BLOCK",
      "POOL_ELIGIBILITY_VALID",
      inactiveTeams.length === 0 && ineligiblePairingPlayers.length === 0
        ? "All admitted teams and pairing-enabled players are active."
        : "Inactive teams or ineligible pairing-enabled players remain.",
      {
        inactiveTeams: inactiveTeams.map((row) => row.name),
        ineligiblePairingPlayers: ineligiblePairingPlayers.map((row) => row.nickname),
      },
    ),
    check(
      teamDerivedRosterConflicts.length === 0 ? "PASS" : "BLOCK",
      "ROSTER_PROVENANCE_RESOLVED",
      teamDerivedRosterConflicts.length === 0
        ? "Every team-derived Pool player is a current formal starter for the source team."
        : "Team-derived Pool players with stale or conflicting starter provenance remain.",
      { players: teamDerivedRosterConflicts.map((row) => row.nickname) },
    ),
    check(
      missingRankingPlayers.length === 0 && nonzeroRankings.length === 0 ? "PASS" : "BLOCK",
      "RANKING_BASELINE_ZERO",
      missingRankingPlayers.length === 0 && nonzeroRankings.length === 0
        ? "Every Pool player has a zeroed ranking baseline."
        : "Ranking coverage is incomplete or production scores are not zero.",
      {
        missingPlayers: missingRankingPlayers.map((row) => row.nickname),
        nonzeroPlayerIds: nonzeroRankings.map((row) => row.playerId.toString()),
      },
    ),
    check(
      unresolvedImports.length === 0 ? "PASS" : "BLOCK",
      "IMPORT_CONFLICTS_RESOLVED",
      unresolvedImports.length === 0
        ? "No unresolved current Pool import proposal or conflict remains."
        : "Pending/conflicting Pool import proposals remain unresolved.",
      {
        proposals: unresolvedImports.map((row) => ({
          conflicts: row.conflictCodes,
          id: row.id.toString(),
          target: row.targetExternalKey,
        })),
      },
    ),
    check(
      missingSources.length === 0 && staleSources.length === 0 ? "PASS" : "BLOCK",
      "POOL_SOURCES_FRESH",
      missingSources.length === 0 && staleSources.length === 0
        ? `Approved HLTV and Valve VRS Pool sources are present and no more than ${input.sourceMaxAgeDays} days old.`
        : "Approved Pool sources are missing or stale; generate and review a fresh Pool draft.",
      {
        maxAgeDays: input.sourceMaxAgeDays,
        missingProviders: missingSources,
        staleProviders: staleSources,
      },
    ),
    check(
      latestPoolDraft?.status === "SUCCEEDED" && draftUsesOlderSource.length === 0
        ? "PASS"
        : "BLOCK",
      "POOL_DRAFT_SUCCEEDED",
      latestPoolDraft?.status === "SUCCEEDED" && draftUsesOlderSource.length === 0
        ? "The latest Pool draft for this Edition completed without source or identity conflicts."
        : "The Edition needs a successful, conflict-free Pool draft after its source review.",
      {
        latestRunId: latestPoolDraft?.id.toString() ?? null,
        latestStatus: latestPoolDraft?.status ?? null,
        outdatedProviders: draftUsesOlderSource,
        sourceFreshnessAt: latestPoolDraft?.sourceFreshnessAt?.toISOString() ?? null,
      },
    ),
    check(
      missingTeamIdentities.length === 0 && missingPlayerIdentities.length === 0 ? "PASS" : "BLOCK",
      "EXTERNAL_IDENTITIES_RESOLVED",
      missingTeamIdentities.length === 0 && missingPlayerIdentities.length === 0
        ? "Every admitted Team and Player has an HLTV identity mapping."
        : "Missing provider identity mappings remain.",
      {
        players: missingPlayerIdentities.map((row) => row.nickname),
        teams: missingTeamIdentities.map((row) => row.name),
      },
    ),
    check(
      integrity.healthy ? "PASS" : "BLOCK",
      "INTEGRITY_HEALTHY",
      integrity.healthy ? "Full integrity report is healthy." : "Integrity violations remain.",
      { violations: integrity.violations },
    ),
    check(
      input.expectedRiskMode === "observe" ? "PASS" : "BLOCK",
      "RISK_MODE_OBSERVE",
      input.expectedRiskMode === "observe"
        ? "Risk enforcement is configured for observe mode."
        : "Closed beta must begin with RISK_ENFORCEMENT_MODE=observe.",
      { configuredMode: input.expectedRiskMode },
    ),
    check(
      unattributedPhotos.length === 0 && unattributedLogos.length === 0 ? "PASS" : "BLOCK",
      "ASSET_ATTRIBUTION_COMPLETE",
      unattributedPhotos.length === 0 && unattributedLogos.length === 0
        ? "Every configured local Pool asset has an attribution entry."
        : "Configured local assets are missing attribution entries.",
      {
        playerAssets: unattributedPhotos.map((row) => row.nickname),
        teamAssets: unattributedLogos.map((row) => row.name),
      },
    ),
    check(
      pendingRightsAssets.length === 0 ? "PASS" : "WARN",
      "ASSET_RIGHTS_REVIEW",
      pendingRightsAssets.length === 0
        ? "No configured asset is marked as pending rights review."
        : "Owner accepted provisional community-beta use; rights review remains pending.",
      { assets: pendingRightsAssets },
    ),
    check(
      missingPhotos.length === 0 && teamsWithoutLogos.length === 0 ? "PASS" : "WARN",
      "PLACEHOLDER_ASSETS_REMAIN",
      missingPhotos.length === 0 && teamsWithoutLogos.length === 0
        ? "All Pool players and teams have configured local assets."
        : "Some Pool entries will use neutral placeholders until approved assets are provided.",
      {
        players: missingPhotos.map((row) => row.nickname),
        teams: teamsWithoutLogos.map((row) => row.name),
      },
    ),
    check(
      missingStats.length === 0 ? "PASS" : "WARN",
      "PLAYER_STATS_MISSING",
      missingStats.length === 0
        ? "Every Pool player has an HLTV stats snapshot."
        : "Some players have no HLTV stats snapshot; the public UI will display an honest missing state.",
      { players: missingStats.map((row) => row.nickname) },
    ),
    check(
      unauditedTeams.length === 0 && unauditedPlayers.length === 0 ? "PASS" : "BLOCK",
      "POOL_AUDIT_COVERAGE",
      unauditedTeams.length === 0 && unauditedPlayers.length === 0
        ? "Each current Pool admission has its corresponding immutable admission log."
        : "Pool admission audit history is incomplete or does not identify current entries.",
      {
        players: unauditedPlayers.map((row) => row.nickname),
        teams: unauditedTeams.map((row) => row.name),
      },
    ),
  ];

  const admissionCounts = {
    CORE: playerRows.filter((row) => row.admissionType === "CORE").length,
    REVIEW_AUTO: playerRows.filter((row) => row.admissionType === "REVIEW_AUTO").length,
    REVIEW_MANUAL: playerRows.filter((row) => row.admissionType === "REVIEW_MANUAL").length,
    SPECIAL: playerRows.filter((row) => row.admissionType === "SPECIAL").length,
  };

  return {
    blocking: checks.some((item) => item.status === "BLOCK"),
    checkedAt: now.toISOString(),
    checks,
    edition: {
      code: currentEdition.code,
      fullWeightBallotsPerDay: currentEdition.fullWeightBallotsPerDay,
      id: currentEdition.id.toString(),
      name: currentEdition.name,
      status: currentEdition.status,
    },
    pool: {
      activePairingPlayers: activePairingRows.length,
      admissionCounts,
      pairCount: pairCount(activePairingRows.length),
      players: playerRows.length,
      teams: teamRows.length,
    },
    warnings: checks.filter((item) => item.status === "WARN").length,
  };
}
