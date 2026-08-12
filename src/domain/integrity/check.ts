import { and, eq, isNull, sql } from "drizzle-orm";

import {
  anonymousVisitors,
  ballots,
  editions,
  pairAggregates,
  playerRankings,
  poolPlayerEntries,
  riskObservations,
  votes,
} from "@/db/schema";
import type { AppDatabase } from "@/domain/database";
import { requireDomainValue } from "@/domain/error";
import { checkScoreIntegrity } from "@/domain/votes/integrity";

export interface IntegrityReport {
  checkedAt: string;
  editionCode: string;
  healthy: boolean;
  score: Awaited<ReturnType<typeof checkScoreIntegrity>>;
  violations: Array<{ code: string; count: number }>;
}

export async function runIntegrityCheck(
  database: AppDatabase,
  input: { editionCode: string; now?: Date },
): Promise<IntegrityReport> {
  const [edition] = await database
    .select({ id: editions.id })
    .from(editions)
    .where(eq(editions.code, input.editionCode))
    .limit(1);
  const current = requireDomainValue(
    edition,
    "EDITION_NOT_FOUND",
    `Edition ${input.editionCode} does not exist`,
  );
  const score = await checkScoreIntegrity(database, current.id);

  const [
    missingRanking,
    duplicateVotes,
    duplicateOpenBallots,
    malformedRiskKeys,
    aggregateMismatch,
  ] = await Promise.all([
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(poolPlayerEntries)
      .leftJoin(
        playerRankings,
        and(
          eq(playerRankings.editionId, poolPlayerEntries.editionId),
          eq(playerRankings.playerId, poolPlayerEntries.playerId),
        ),
      )
      .where(and(eq(poolPlayerEntries.editionId, current.id), isNull(playerRankings.playerId))),
    database.execute<{ count: number }>(sql`
        select count(*)::int as count from (
          select ballot_id from ${votes} group by ballot_id having count(*) > 1
        ) duplicate_vote
      `),
    database.execute<{ count: number }>(sql`
        select count(*)::int as count from (
          select visitor_id, edition_id from ${ballots}
          where status = 'OPEN' group by visitor_id, edition_id having count(*) > 1
        ) duplicate_open
      `),
    database.execute<{ count: number }>(sql`
        select (
          (select count(*) from ${ballots} where issued_ip_risk_key is not null and octet_length(issued_ip_risk_key) <> 32) +
          (select count(*) from ${votes} where ip_risk_key is not null and octet_length(ip_risk_key) <> 32) +
          (select count(*) from ${riskObservations} where ip_risk_key is not null and octet_length(ip_risk_key) <> 32) +
          (select count(*) from ${anonymousVisitors} where octet_length(token_hash) <> 32)
        )::int as count
      `),
    database.execute<{ count: number }>(sql`
        with expected as (
          select
            b.edition_id,
            b.player_1_id,
            b.player_2_id,
            count(*) filter (where v.status = 'VALID' and v.choice <> 'SKIP' and v.winner_player_id = b.player_1_id)::bigint as p1,
            count(*) filter (where v.status = 'VALID' and v.choice <> 'SKIP' and v.winner_player_id = b.player_2_id)::bigint as p2,
            count(*) filter (where v.status = 'VALID' and v.choice = 'SKIP')::bigint as skips
          from ${votes} v join ${ballots} b on b.id = v.ballot_id
          where v.edition_id = ${current.id}
          group by b.edition_id, b.player_1_id, b.player_2_id
        ), compared as (
          select
            coalesce(e.edition_id, p.edition_id) as edition_id,
            coalesce(e.player_1_id, p.player_1_id) as player_1_id,
            coalesce(e.player_2_id, p.player_2_id) as player_2_id,
            coalesce(e.p1, 0) <> coalesce(p.counted_player_1_wins, 0)
              or coalesce(e.p2, 0) <> coalesce(p.counted_player_2_wins, 0)
              or coalesce(e.skips, 0) <> coalesce(p.counted_skips, 0) as mismatch
          from expected e full outer join ${pairAggregates} p
            on p.edition_id = e.edition_id
            and p.player_1_id = e.player_1_id
            and p.player_2_id = e.player_2_id
          where coalesce(e.edition_id, p.edition_id) = ${current.id}
        )
        select count(*) filter (where mismatch)::int as count from compared
      `),
  ]);

  const violations = [
    ...score.violations.map((code) => ({ code, count: 1 })),
    { code: "POOL_RANKING_ROW_MISSING", count: missingRanking[0]?.count ?? 0 },
    { code: "DUPLICATE_VOTE_PER_BALLOT", count: duplicateVotes.rows[0]?.count ?? 0 },
    { code: "DUPLICATE_OPEN_BALLOT", count: duplicateOpenBallots.rows[0]?.count ?? 0 },
    { code: "MALFORMED_PSEUDONYMOUS_KEY", count: malformedRiskKeys.rows[0]?.count ?? 0 },
    { code: "PAIR_AGGREGATE_DETAIL_MISMATCH", count: aggregateMismatch.rows[0]?.count ?? 0 },
  ].filter((violation) => violation.count > 0);

  return {
    checkedAt: (input.now ?? new Date()).toISOString(),
    editionCode: input.editionCode,
    healthy: violations.length === 0,
    score,
    violations,
  };
}
