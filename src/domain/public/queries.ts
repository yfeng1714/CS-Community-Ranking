import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  editions,
  playerRankings,
  players,
  playerStatSnapshots,
  poolPlayerEntries,
  rosterMemberships,
  teams,
} from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { calculateWinRate, dataFreshness, toPublicCount, toPublicMetric } from "./presentation.ts";
import type {
  PublicEdition,
  PublicPlayerProfile,
  PublicPlayerStats,
  PublicRanking,
  PublicRankingPlayer,
} from "./types.ts";

interface RankingSourceRow {
  country: string | null;
  losses: bigint;
  nickname: string;
  photoUrl: string | null;
  playerId: bigint;
  score: number;
  skips: bigint;
  slug: string;
  team: string | null;
  teamShortName: string | null;
  updatedAt: Date;
  wins: bigint;
}

export async function getActivePublicEdition(
  database: AppDatabase,
): Promise<(PublicEdition & { id: bigint }) | null> {
  const [edition] = await database
    .select({
      code: editions.code,
      id: editions.id,
      name: editions.name,
      status: editions.status,
    })
    .from(editions)
    .where(eq(editions.status, "ACTIVE"))
    .limit(1);

  return edition ?? null;
}

function presentRankingRows(rows: readonly RankingSourceRow[]): PublicRankingPlayer[] {
  const sorted = [...rows].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    const decisionDifference =
      right.wins + right.losses > left.wins + left.losses
        ? 1
        : right.wins + right.losses < left.wins + left.losses
          ? -1
          : 0;
    return decisionDifference || left.nickname.localeCompare(right.nickname, "en");
  });
  let previousScore: number | undefined;
  let rank = 0;

  return sorted.map((row, index) => {
    if (previousScore === undefined || row.score !== previousScore) {
      rank = index + 1;
      previousScore = row.score;
    }
    const wins = toPublicCount(row.wins, "ranking wins");
    const losses = toPublicCount(row.losses, "ranking losses");

    return {
      country: row.country,
      decisions: wins + losses,
      losses,
      nickname: row.nickname,
      photoUrl: row.photoUrl,
      rank,
      score: row.score,
      skips: toPublicCount(row.skips, "ranking skips"),
      slug: row.slug,
      team: row.team,
      teamShortName: row.teamShortName,
      updatedAt: row.updatedAt.toISOString(),
      winRate: calculateWinRate(wins, losses),
      wins,
    };
  });
}

async function loadRankingRows(database: AppDatabase, editionId: bigint) {
  return database
    .select({
      country: players.countryCode,
      losses: playerRankings.losses,
      nickname: players.nickname,
      photoUrl: players.photoPath,
      playerId: players.id,
      score: playerRankings.score,
      skips: playerRankings.skips,
      slug: players.slug,
      team: teams.name,
      teamShortName: teams.shortName,
      updatedAt: playerRankings.updatedAt,
      wins: playerRankings.wins,
    })
    .from(poolPlayerEntries)
    .innerJoin(players, eq(players.id, poolPlayerEntries.playerId))
    .innerJoin(
      playerRankings,
      and(
        eq(playerRankings.editionId, poolPlayerEntries.editionId),
        eq(playerRankings.playerId, poolPlayerEntries.playerId),
      ),
    )
    .leftJoin(
      rosterMemberships,
      and(eq(rosterMemberships.playerId, players.id), isNull(rosterMemberships.endsAt)),
    )
    .leftJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .where(eq(poolPlayerEntries.editionId, editionId));
}

export async function getPublicRanking(database: AppDatabase): Promise<PublicRanking> {
  const edition = await getActivePublicEdition(database);
  if (!edition) {
    return { edition: null, players: [], updatedAt: null };
  }

  const players = presentRankingRows(await loadRankingRows(database, edition.id));
  const updatedAt = players.reduce<string | null>(
    (latest, player) => (!latest || player.updatedAt > latest ? player.updatedAt : latest),
    null,
  );

  return {
    edition: { code: edition.code, name: edition.name, status: edition.status },
    players,
    updatedAt,
  };
}

export async function getPublicPlayer(
  database: AppDatabase,
  slug: string,
  now: Date = new Date(),
  statsStaleAfterHours = 48,
): Promise<PublicPlayerProfile | null> {
  const [player] = await database
    .select({
      country: players.countryCode,
      hltvProfileUrl: players.hltvProfileUrl,
      id: players.id,
      nickname: players.nickname,
      photoUrl: players.photoPath,
      professionalStatus: players.professionalStatus,
      realName: players.realName,
      slug: players.slug,
      team: teams.name,
      teamShortName: teams.shortName,
    })
    .from(players)
    .leftJoin(
      rosterMemberships,
      and(eq(rosterMemberships.playerId, players.id), isNull(rosterMemberships.endsAt)),
    )
    .leftJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .where(eq(players.slug, slug))
    .limit(1);
  if (!player) {
    return null;
  }

  const edition = await getActivePublicEdition(database);
  const [rankingRows, stats] = await Promise.all([
    edition ? loadRankingRows(database, edition.id) : Promise.resolve([]),
    getPublicPlayerStats(database, player.id, now, statsStaleAfterHours),
  ]);
  const ranking = presentRankingRows(rankingRows).find((row) => row.slug === slug) ?? null;

  return {
    careerRating: stats.careerRating,
    country: player.country,
    freshness: stats.freshness,
    hltvProfileUrl: player.hltvProfileUrl,
    nickname: player.nickname,
    photoUrl: player.photoUrl,
    professionalStatus: player.professionalStatus,
    ranking,
    realName: player.realName,
    recentMaps: stats.recentMaps,
    recentRating: stats.recentRating,
    slug: player.slug,
    statsCapturedAt: stats.statsCapturedAt,
    team: player.team,
    teamShortName: player.teamShortName,
  };
}

export async function getPublicPlayerStats(
  database: AppDatabase,
  playerId: bigint,
  now: Date = new Date(),
  staleAfterHours = 48,
): Promise<PublicPlayerStats> {
  const statRows = await database
    .select({
      capturedAt: playerStatSnapshots.capturedAt,
      maps: playerStatSnapshots.maps,
      metric: playerStatSnapshots.metric,
      periodType: playerStatSnapshots.periodType,
      value: playerStatSnapshots.value,
    })
    .from(playerStatSnapshots)
    .where(
      and(
        eq(playerStatSnapshots.playerId, playerId),
        eq(playerStatSnapshots.provider, "HLTV"),
        inArray(playerStatSnapshots.metric, ["rating_3_0", "career_rating"]),
      ),
    )
    .orderBy(desc(playerStatSnapshots.capturedAt));
  const recent = statRows.find(
    (row) => row.metric === "rating_3_0" && row.periodType === "LAST_3_MONTHS",
  );
  const career = statRows.find(
    (row) => row.metric === "career_rating" && row.periodType === "CAREER",
  );
  const capturedAt = recent?.capturedAt ?? career?.capturedAt ?? null;

  return {
    careerRating: toPublicMetric(career?.value),
    freshness: dataFreshness(capturedAt, now, staleAfterHours * 60 * 60 * 1_000),
    recentMaps: recent?.maps ?? null,
    recentRating: toPublicMetric(recent?.value),
    statsCapturedAt: capturedAt?.toISOString() ?? null,
  };
}
