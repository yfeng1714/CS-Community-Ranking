import { and, isNotNull, lt, sql } from "drizzle-orm";

import { apiRequestMetrics, ballots, productEvents, riskObservations, votes } from "@/db/schema";
import type { AppDatabase } from "@/domain/database";

export async function expireOpenBallots(
  database: AppDatabase,
  input: { batchSize?: number; now?: Date } = {},
): Promise<{ expired: number }> {
  const now = input.now ?? new Date();
  const batchSize = input.batchSize ?? 500;
  const result = await database.execute<{ id: string }>(sql`
    with selected as (
      select id from ${ballots}
      where status = 'OPEN' and expires_at <= ${now}
      order by expires_at, id
      limit ${batchSize}
      for update skip locked
    )
    update ${ballots} set status = 'EXPIRED'
    where id in (select id from selected)
    returning id
  `);
  return { expired: result.rows.length };
}

export async function runRetentionCleanup(
  database: AppDatabase,
  input: {
    ipRiskKeyRetentionDays: number;
    now?: Date;
    productEventRetentionDays: number;
  },
): Promise<{
  apiMetricsDeleted: number;
  ballotRiskKeysNulled: number;
  productEventsDeleted: number;
  riskObservationsDeleted: number;
  voteRiskKeysNulled: number;
}> {
  const now = input.now ?? new Date();
  const ipCutoff = new Date(now.getTime() - input.ipRiskKeyRetentionDays * 86_400_000);
  const eventCutoff = new Date(now.getTime() - input.productEventRetentionDays * 86_400_000);

  return database.transaction(async (transaction) => {
    const ballotRows = await transaction
      .update(ballots)
      .set({ issuedIpRiskKey: null })
      .where(and(lt(ballots.issuedAt, ipCutoff), isNotNull(ballots.issuedIpRiskKey)))
      .returning({ id: ballots.id });
    const voteRows = await transaction
      .update(votes)
      .set({ ipRiskKey: null })
      .where(and(lt(votes.createdAt, ipCutoff), isNotNull(votes.ipRiskKey)))
      .returning({ id: votes.id });
    const deletedObservations = await transaction
      .delete(riskObservations)
      .where(lt(riskObservations.occurredAt, ipCutoff))
      .returning({ id: riskObservations.id });
    const eventRows = await transaction
      .delete(productEvents)
      .where(lt(productEvents.occurredAt, eventCutoff))
      .returning({ id: productEvents.id });
    const metricRows = await transaction
      .delete(apiRequestMetrics)
      .where(lt(apiRequestMetrics.occurredAt, eventCutoff))
      .returning({ id: apiRequestMetrics.id });
    return {
      apiMetricsDeleted: metricRows.length,
      ballotRiskKeysNulled: ballotRows.length,
      productEventsDeleted: eventRows.length,
      riskObservationsDeleted: deletedObservations.length,
      voteRiskKeysNulled: voteRows.length,
    };
  });
}
