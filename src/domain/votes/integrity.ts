import { eq } from "drizzle-orm";

import { pairAggregates, playerRankings, votes } from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";

export interface ScoreIntegrityReport {
  countedPairDecisions: string;
  countedPairSkips: string;
  editionId: string;
  healthy: boolean;
  rankingLosses: string;
  rankingSkips: string;
  rankingWins: string;
  scoreSum: string;
  validDecisionVotes: string;
  validSkipVotes: string;
  violations: string[];
}

export async function checkScoreIntegrity(
  database: AppDatabase,
  editionId: bigint,
): Promise<ScoreIntegrityReport> {
  return database.transaction(
    async (transaction) => {
      const rankingRows = await transaction
        .select({
          losses: playerRankings.losses,
          score: playerRankings.score,
          skips: playerRankings.skips,
          wins: playerRankings.wins,
        })
        .from(playerRankings)
        .where(eq(playerRankings.editionId, editionId));
      const aggregateRows = await transaction
        .select({
          player1Wins: pairAggregates.countedPlayer1Wins,
          player2Wins: pairAggregates.countedPlayer2Wins,
          skips: pairAggregates.countedSkips,
        })
        .from(pairAggregates)
        .where(eq(pairAggregates.editionId, editionId));
      const voteRows = await transaction
        .select({ choice: votes.choice, status: votes.status })
        .from(votes)
        .where(eq(votes.editionId, editionId));

      const rankingWins = rankingRows.reduce((sum, row) => sum + row.wins, 0n);
      const rankingLosses = rankingRows.reduce((sum, row) => sum + row.losses, 0n);
      const rankingSkips = rankingRows.reduce((sum, row) => sum + row.skips, 0n);
      const scoreSum = rankingRows.reduce((sum, row) => sum + BigInt(row.score), 0n);
      const countedPairDecisions = aggregateRows.reduce(
        (sum, row) => sum + row.player1Wins + row.player2Wins,
        0n,
      );
      const countedPairSkips = aggregateRows.reduce((sum, row) => sum + row.skips, 0n);
      const validDecisionVotes = BigInt(
        voteRows.filter((vote) => vote.status === "VALID" && vote.choice !== "SKIP").length,
      );
      const validSkipVotes = BigInt(
        voteRows.filter((vote) => vote.status === "VALID" && vote.choice === "SKIP").length,
      );
      const violations: string[] = [];

      if (scoreSum !== 0n) {
        violations.push("SUM_SCORE_NOT_ZERO");
      }
      if (rankingWins !== rankingLosses) {
        violations.push("RANKING_WINS_LOSSES_MISMATCH");
      }
      if (rankingWins !== validDecisionVotes) {
        violations.push("RANKING_DECISION_VOTE_MISMATCH");
      }
      if (countedPairDecisions !== validDecisionVotes) {
        violations.push("PAIR_DECISION_VOTE_MISMATCH");
      }
      if (rankingSkips !== validSkipVotes * 2n) {
        violations.push("RANKING_SKIP_VOTE_MISMATCH");
      }
      if (countedPairSkips !== validSkipVotes) {
        violations.push("PAIR_SKIP_VOTE_MISMATCH");
      }
      if (rankingRows.some((row) => BigInt(row.score) !== row.wins - row.losses)) {
        violations.push("RANKING_ROW_SCORE_MISMATCH");
      }

      return {
        countedPairDecisions: countedPairDecisions.toString(),
        countedPairSkips: countedPairSkips.toString(),
        editionId: editionId.toString(),
        healthy: violations.length === 0,
        rankingLosses: rankingLosses.toString(),
        rankingSkips: rankingSkips.toString(),
        rankingWins: rankingWins.toString(),
        scoreSum: scoreSum.toString(),
        validDecisionVotes: validDecisionVotes.toString(),
        validSkipVotes: validSkipVotes.toString(),
        violations,
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" },
  );
}
