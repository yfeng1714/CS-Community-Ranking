import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";

import {
  apiRequestMetrics,
  ballots,
  editions,
  productEvents,
  syncRuns,
  visitorDailyUsage,
  votes,
} from "@/db/schema";
import { dateInTimeZone } from "@/domain/ballots/date";
import type { AppDatabase } from "@/domain/database";
import { requireDomainValue } from "@/domain/error";

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}

export interface DailyKpiReport {
  api: {
    errorRate: number | null;
    errors: number;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    requests: number;
  };
  ballot: {
    averageIssuedPerVisitor: number | null;
    averageValidDecisionsPerVisitor: number | null;
    issued: number;
    nextClickRate: number | null;
    rankingViewRateAfterVoting: number | null;
    repeatVisitors: number;
    resolvedPercentage: number | null;
    skipRate: number | null;
    throttledPercentage: number | null;
    visitors: number;
  };
  date: string;
  editionCode: string;
  freshness: Array<{
    finishedAt: string | null;
    jobName: string;
    provider: string;
    sourceFreshnessAt: string | null;
    status: string;
  }>;
  skipRateByPlayer: Array<{
    appearances: number;
    playerId: string;
    skipRate: number | null;
    skips: number;
  }>;
}

export async function generateDailyKpiReport(
  database: AppDatabase,
  input: { date: string; editionCode: string; timeZone: string },
): Promise<DailyKpiReport> {
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

  const start = new Date(`${input.date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1_000);
  if (dateInTimeZone(start, input.timeZone) !== input.date) {
    throw new Error("KPI date boundary does not match APP_TIME_ZONE");
  }

  const [usage, priorUsage, ballotRows, voteRows, events, requestMetrics, freshness] =
    await Promise.all([
      database
        .select()
        .from(visitorDailyUsage)
        .where(
          and(
            eq(visitorDailyUsage.editionId, current.id),
            eq(visitorDailyUsage.usageDate, input.date),
          ),
        ),
      database
        .select({ visitorId: visitorDailyUsage.visitorId })
        .from(visitorDailyUsage)
        .where(
          and(
            eq(visitorDailyUsage.editionId, current.id),
            lt(visitorDailyUsage.usageDate, input.date),
          ),
        ),
      database
        .select({ status: ballots.status, visitorId: ballots.visitorId })
        .from(ballots)
        .where(
          and(
            eq(ballots.editionId, current.id),
            gte(ballots.issuedAt, start),
            lt(ballots.issuedAt, end),
          ),
        ),
      database
        .select({
          choice: votes.choice,
          loserPlayerId: votes.loserPlayerId,
          createdAt: votes.createdAt,
          status: votes.status,
          visitorId: votes.visitorId,
          winnerPlayerId: votes.winnerPlayerId,
        })
        .from(votes)
        .where(
          and(
            eq(votes.editionId, current.id),
            gte(votes.createdAt, start),
            lt(votes.createdAt, end),
          ),
        ),
      database
        .select({
          eventType: productEvents.eventType,
          occurredAt: productEvents.occurredAt,
          visitorId: productEvents.visitorId,
        })
        .from(productEvents)
        .where(
          and(
            eq(productEvents.editionId, current.id),
            gte(productEvents.occurredAt, start),
            lt(productEvents.occurredAt, end),
          ),
        ),
      database
        .select({
          latencyMs: apiRequestMetrics.latencyMs,
          statusCode: apiRequestMetrics.statusCode,
        })
        .from(apiRequestMetrics)
        .where(
          and(
            inArray(apiRequestMetrics.route, [
              "/api/v1/ballots/next",
              "/api/v1/ballots/{public_id}/resolve",
            ]),
            gte(apiRequestMetrics.occurredAt, start),
            lt(apiRequestMetrics.occurredAt, end),
          ),
        ),
      database
        .select({
          finishedAt: syncRuns.finishedAt,
          jobName: syncRuns.jobName,
          provider: syncRuns.provider,
          sourceFreshnessAt: syncRuns.sourceFreshnessAt,
          status: syncRuns.status,
        })
        .from(syncRuns)
        .orderBy(desc(syncRuns.startedAt)),
    ]);

  const visitors = new Set(usage.map((row) => row.visitorId.toString()));
  const firstVoteAt = new Map<string, Date>();
  for (const vote of voteRows) {
    const visitor = vote.visitorId.toString();
    const current = firstVoteAt.get(visitor);
    if (!current || vote.createdAt < current) firstVoteAt.set(visitor, vote.createdAt);
  }
  const eventBounds = (eventType: (typeof events)[number]["eventType"]) => {
    const output = new Map<string, Date>();
    for (const event of events) {
      if (event.eventType !== eventType || !event.visitorId) continue;
      const visitor = event.visitorId.toString();
      const current = output.get(visitor);
      if (!current || event.occurredAt > current) output.set(visitor, event.occurredAt);
    }
    return output;
  };
  const latestResultAt = eventBounds("VOTE_RESULT_VIEW");
  const latestNextAt = eventBounds("NEXT_CLICK");
  const latestRankingAt = eventBounds("RANKING_VIEW");
  const validVotes = voteRows.filter((row) => row.status === "VALID");
  const resolved = ballotRows.filter((row) => row.status === "RESOLVED").length;
  const throttled = voteRows.filter((row) => row.status === "THROTTLED").length;
  const priorVisitors = new Set(priorUsage.map((row) => row.visitorId.toString()));
  const repeatVisitors = [...visitors].filter((visitor) => priorVisitors.has(visitor)).length;
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const playerAppearance = new Map<string, { appearances: number; skips: number }>();
  const validBallots = await database
    .select({
      choice: votes.choice,
      player1Id: ballots.player1Id,
      player2Id: ballots.player2Id,
    })
    .from(votes)
    .innerJoin(ballots, eq(ballots.id, votes.ballotId))
    .where(
      and(
        eq(votes.editionId, current.id),
        eq(votes.status, "VALID"),
        gte(votes.createdAt, start),
        lt(votes.createdAt, end),
      ),
    );
  for (const vote of validBallots) {
    for (const playerId of [vote.player1Id.toString(), vote.player2Id.toString()]) {
      const value = playerAppearance.get(playerId) ?? { appearances: 0, skips: 0 };
      value.appearances += 1;
      if (vote.choice === "SKIP") value.skips += 1;
      playerAppearance.set(playerId, value);
    }
  }
  const seenFreshness = new Set<string>();
  const latestFreshness = freshness.filter((row) => {
    const key = `${row.jobName}:${row.provider}`;
    if (seenFreshness.has(key)) return false;
    seenFreshness.add(key);
    return true;
  });

  return {
    api: {
      errorRate: ratio(
        requestMetrics.filter((row) => row.statusCode >= 400).length,
        requestMetrics.length,
      ),
      errors: requestMetrics.filter((row) => row.statusCode >= 400).length,
      p50LatencyMs: percentile(
        requestMetrics.map((row) => row.latencyMs),
        0.5,
      ),
      p95LatencyMs: percentile(
        requestMetrics.map((row) => row.latencyMs),
        0.95,
      ),
      requests: requestMetrics.length,
    },
    ballot: {
      averageIssuedPerVisitor: ratio(sum(usage.map((row) => row.ballotsIssued)), usage.length),
      averageValidDecisionsPerVisitor: ratio(
        sum(usage.map((row) => row.validResolved - row.validSkips)),
        usage.length,
      ),
      issued: ballotRows.length,
      nextClickRate: ratio(
        [...latestResultAt].filter(
          ([visitor, resultAt]) =>
            (latestNextAt.get(visitor)?.getTime() ?? 0) >= resultAt.getTime(),
        ).length,
        latestResultAt.size,
      ),
      rankingViewRateAfterVoting: ratio(
        [...firstVoteAt].filter(
          ([visitor, voteAt]) => (latestRankingAt.get(visitor)?.getTime() ?? 0) >= voteAt.getTime(),
        ).length,
        firstVoteAt.size,
      ),
      repeatVisitors,
      resolvedPercentage: ratio(resolved, ballotRows.length),
      skipRate: ratio(validVotes.filter((row) => row.choice === "SKIP").length, validVotes.length),
      throttledPercentage: ratio(throttled, voteRows.length),
      visitors: visitors.size,
    },
    date: input.date,
    editionCode: input.editionCode,
    freshness: latestFreshness.map((row) => ({
      ...row,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      sourceFreshnessAt: row.sourceFreshnessAt?.toISOString() ?? null,
    })),
    skipRateByPlayer: [...playerAppearance.entries()].map(([playerId, value]) => ({
      ...value,
      playerId,
      skipRate: ratio(value.skips, value.appearances),
    })),
  };
}
