import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  ballots,
  moderationAuditLogs,
  pairAggregates,
  playerRankings,
  votes,
} from "../../db/schema/index.ts";
import { toAuditRecord } from "../audit.ts";
import type { AppDatabase, AppTransaction } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";

export class VoteModerationService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async revoke(input: { actorAdminUserId: bigint; reason: string; voteId: bigint }) {
    const reason = requireNonBlank(input.reason, "Vote revocation reason");

    return this.database.transaction((transaction) =>
      this.revokeInTransaction(transaction, { ...input, reason }),
    );
  }

  private async revokeInTransaction(
    transaction: AppTransaction,
    input: { actorAdminUserId: bigint; reason: string; voteId: bigint },
  ) {
    const now = this.now();
    const [vote] = await transaction
      .select()
      .from(votes)
      .where(eq(votes.id, input.voteId))
      .for("update")
      .limit(1);
    const current = requireDomainValue(vote, "VOTE_NOT_FOUND", "Vote does not exist");
    const [ballot] = await transaction
      .select()
      .from(ballots)
      .where(eq(ballots.id, current.ballotId))
      .for("update")
      .limit(1);
    const lockedBallot = requireDomainValue(
      ballot,
      "BALLOT_NOT_FOUND",
      "Vote references a missing Ballot",
    );

    if (current.status !== "VALID") {
      throw new DomainError(
        "VOTE_NOT_REVOCABLE",
        `Only a VALID Vote can be revoked; current status is ${current.status}`,
      );
    }

    const [aggregate] = await transaction
      .select()
      .from(pairAggregates)
      .where(
        and(
          eq(pairAggregates.editionId, lockedBallot.editionId),
          eq(pairAggregates.player1Id, lockedBallot.player1Id),
          eq(pairAggregates.player2Id, lockedBallot.player2Id),
        ),
      )
      .for("update")
      .limit(1);
    requireDomainValue(
      aggregate,
      "PAIR_AGGREGATE_NOT_FOUND",
      "Vote references a missing PairAggregate",
    );

    const rankingRows = await transaction
      .select({ playerId: playerRankings.playerId })
      .from(playerRankings)
      .where(
        and(
          eq(playerRankings.editionId, lockedBallot.editionId),
          inArray(playerRankings.playerId, [lockedBallot.player1Id, lockedBallot.player2Id]),
        ),
      )
      .orderBy(asc(playerRankings.playerId))
      .for("update");
    if (rankingRows.length !== 2) {
      throw new DomainError(
        "RANKING_ROWS_MISSING",
        "Both Vote players require ranking rows before revocation",
      );
    }

    for (const row of rankingRows) {
      if (current.choice === "SKIP") {
        await transaction
          .update(playerRankings)
          .set({ skips: sql`${playerRankings.skips} - 1`, updatedAt: now })
          .where(
            and(
              eq(playerRankings.editionId, lockedBallot.editionId),
              eq(playerRankings.playerId, row.playerId),
            ),
          );
      } else if (row.playerId === current.winnerPlayerId) {
        await transaction
          .update(playerRankings)
          .set({
            score: sql`${playerRankings.score} - 1`,
            updatedAt: now,
            wins: sql`${playerRankings.wins} - 1`,
          })
          .where(
            and(
              eq(playerRankings.editionId, lockedBallot.editionId),
              eq(playerRankings.playerId, row.playerId),
            ),
          );
      } else if (row.playerId === current.loserPlayerId) {
        await transaction
          .update(playerRankings)
          .set({
            losses: sql`${playerRankings.losses} - 1`,
            score: sql`${playerRankings.score} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(playerRankings.editionId, lockedBallot.editionId),
              eq(playerRankings.playerId, row.playerId),
            ),
          );
      } else {
        throw new DomainError("VOTE_PLAYER_MISMATCH", "Vote players do not match its Ballot");
      }
    }

    const player1Won = current.winnerPlayerId === lockedBallot.player1Id;
    const player2Won = current.winnerPlayerId === lockedBallot.player2Id;
    await transaction
      .update(pairAggregates)
      .set({
        countedPlayer1Wins: sql`${pairAggregates.countedPlayer1Wins} - ${player1Won ? 1 : 0}`,
        countedPlayer2Wins: sql`${pairAggregates.countedPlayer2Wins} - ${player2Won ? 1 : 0}`,
        countedSkips: sql`${pairAggregates.countedSkips} - ${current.choice === "SKIP" ? 1 : 0}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(pairAggregates.editionId, lockedBallot.editionId),
          eq(pairAggregates.player1Id, lockedBallot.player1Id),
          eq(pairAggregates.player2Id, lockedBallot.player2Id),
        ),
      );

    const [revoked] = await transaction
      .update(votes)
      .set({
        revokedAt: now,
        revokedBy: input.actorAdminUserId,
        revokedReason: input.reason,
        status: "REVOKED",
      })
      .where(eq(votes.id, current.id))
      .returning();
    const after = requireDomainValue(
      revoked,
      "VOTE_REVOKE_FAILED",
      "Vote revocation update returned no row",
    );

    await transaction.insert(moderationAuditLogs).values({
      action: "REVOKE_VOTE",
      actorAdminUserId: input.actorAdminUserId,
      after: toAuditRecord(after)!,
      before: toAuditRecord(current)!,
      reason: input.reason,
      voteId: current.id,
    });

    return after;
  }
}
