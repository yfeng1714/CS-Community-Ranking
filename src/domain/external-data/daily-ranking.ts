import { eq, sql } from "drizzle-orm";

import { dailyRankingSnapshots, editions, playerRankings } from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { requireDomainValue } from "../error.ts";

export async function snapshotDailyRanking(
  database: AppDatabase,
  input: { editionCode: string; snapshotDate: string },
): Promise<{ editionId: bigint; rows: number }> {
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

  const rankings = await database
    .select({
      losses: playerRankings.losses,
      playerId: playerRankings.playerId,
      rank: sql<number>`rank() over (order by ${playerRankings.score} desc)`,
      score: playerRankings.score,
      skips: playerRankings.skips,
      wins: playerRankings.wins,
    })
    .from(playerRankings)
    .where(eq(playerRankings.editionId, current.id));

  if (rankings.length > 0) {
    await database
      .insert(dailyRankingSnapshots)
      .values(
        rankings.map((row) => ({
          ...row,
          editionId: current.id,
          snapshotDate: input.snapshotDate,
        })),
      )
      .onConflictDoUpdate({
        target: [
          dailyRankingSnapshots.editionId,
          dailyRankingSnapshots.snapshotDate,
          dailyRankingSnapshots.playerId,
        ],
        set: {
          losses: sql`excluded.losses`,
          rank: sql`excluded.rank`,
          score: sql`excluded.score`,
          skips: sql`excluded.skips`,
          wins: sql`excluded.wins`,
        },
      });
  }
  return { editionId: current.id, rows: rankings.length };
}
