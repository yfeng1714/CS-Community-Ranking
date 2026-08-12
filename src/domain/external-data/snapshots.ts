import { and, desc, eq, sql } from "drizzle-orm";

import { playerStatSnapshots, rankingSourceSnapshots } from "../../db/schema/index.ts";
import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import type { NormalizedPlayerStats, NormalizedRankingSnapshot } from "./types.ts";

export async function writeRankingSourceSnapshot(
  database: AppDatabase,
  input: {
    capturedAt: Date;
    checksum: string;
    parserVersion: string;
    provider: "HLTV" | "VALVE_VRS";
    snapshot: NormalizedRankingSnapshot;
  },
): Promise<{ changed: boolean; id: bigint }> {
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`ranking-source:${input.provider}`}))`,
    );
    const [existing] = await transaction
      .select({ id: rankingSourceSnapshots.id })
      .from(rankingSourceSnapshots)
      .where(
        and(
          eq(rankingSourceSnapshots.provider, input.provider),
          eq(rankingSourceSnapshots.rawChecksum, input.checksum),
        ),
      )
      .limit(1);
    if (existing) return { changed: false, id: existing.id };

    const [created] = await transaction
      .insert(rankingSourceSnapshots)
      .values({
        capturedAt: input.capturedAt,
        normalizedData: input.snapshot,
        parserVersion: requireNonBlank(input.parserVersion, "parser version"),
        provider: input.provider,
        publishedAt: new Date(input.snapshot.publishedAt),
        rawChecksum: requireNonBlank(input.checksum, "source checksum"),
      })
      .returning({ id: rankingSourceSnapshots.id });
    return {
      changed: true,
      id: requireDomainValue(created, "SNAPSHOT_WRITE_FAILED", "Ranking snapshot insert failed").id,
    };
  });
}

export async function approveRankingSourceSnapshot(
  database: AppDatabase,
  input: { actorAdminUserId: bigint; reason: string; snapshotId: bigint },
) {
  const reason = requireNonBlank(input.reason, "ranking snapshot approval reason");
  return database.transaction(async (transaction) => {
    const [before] = await transaction
      .select()
      .from(rankingSourceSnapshots)
      .where(eq(rankingSourceSnapshots.id, input.snapshotId))
      .for("update")
      .limit(1);
    const current = requireDomainValue(
      before,
      "RANKING_SNAPSHOT_NOT_FOUND",
      `Ranking snapshot ${input.snapshotId} not found`,
    );
    if (current.approvedAt) {
      throw new DomainError(
        "RANKING_SNAPSHOT_ALREADY_APPROVED",
        "Ranking snapshot is already approved",
      );
    }
    const [after] = await transaction
      .update(rankingSourceSnapshots)
      .set({ approvedAt: new Date(), approvedBy: input.actorAdminUserId })
      .where(eq(rankingSourceSnapshots.id, input.snapshotId))
      .returning();
    const approved = requireDomainValue(
      after,
      "RANKING_SNAPSHOT_APPROVE_FAILED",
      "Snapshot approval failed",
    );
    await writeAdminAudit(transaction, {
      action: "APPROVE_RANKING_SOURCE_SNAPSHOT",
      actorAdminUserId: input.actorAdminUserId,
      after: approved,
      before: current,
      reason,
      targetId: approved.id.toString(),
      targetType: "RANKING_SOURCE_SNAPSHOT",
    });
    return approved;
  });
}

export async function writeHltvPlayerStats(
  database: AppDatabase,
  input: { capturedAt: Date; playerId: bigint; stats: NormalizedPlayerStats },
): Promise<number> {
  const [latest] = await database
    .select({ capturedAt: playerStatSnapshots.capturedAt })
    .from(playerStatSnapshots)
    .where(
      and(
        eq(playerStatSnapshots.playerId, input.playerId),
        eq(playerStatSnapshots.provider, "HLTV"),
      ),
    )
    .orderBy(desc(playerStatSnapshots.capturedAt))
    .limit(1);
  if (latest?.capturedAt.getTime() === input.capturedAt.getTime()) return 0;

  await database.insert(playerStatSnapshots).values([
    {
      capturedAt: input.capturedAt,
      maps: input.stats.recent.maps,
      metric: "rating_3_0",
      periodEnd: input.stats.recent.periodEnd,
      periodStart: input.stats.recent.periodStart,
      periodType: "LAST_3_MONTHS",
      playerId: input.playerId,
      provider: "HLTV",
      sourceUrl: input.stats.sourceUrl,
      value: String(input.stats.recent.rating),
    },
    {
      capturedAt: input.capturedAt,
      maps: input.stats.career.maps,
      metric: "career_rating",
      periodType: "CAREER",
      playerId: input.playerId,
      provider: "HLTV",
      sourceUrl: input.stats.sourceUrl,
      value: String(input.stats.career.rating),
    },
  ]);
  return 2;
}
