import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  ballots,
  editions,
  pairAggregates,
  playerRankings,
  visitorDailyUsage,
  votes,
} from "../../db/schema/index.ts";
import { withTransactionRetry } from "../ballots/retry.ts";
import type { AppDatabase, AppTransaction } from "../database.ts";
import { DomainError, requireDomainValue } from "../error.ts";
import {
  buildHeadToHead,
  mapEligibilityToVoteStatus,
  rankPlayerRows,
  resolveChoicePlayers,
  type ResolutionChoice,
  type ResolutionResponse,
} from "./presentation.ts";

export interface ResolutionHooks {
  afterFirstRankingUpdate?(): Promise<void> | void;
  afterVoteInsert?(): Promise<void> | void;
}

interface ResolvedCore {
  alreadyResolved: boolean;
  ballotId: bigint;
  choice: ResolutionChoice;
  editionId: bigint;
  leftPlayerId: bigint;
  player1Id: bigint;
  player2Id: bigint;
  rightPlayerId: bigint;
}

type TransactionOutcome =
  { kind: "edition-inactive" } | { kind: "expired" } | { core: ResolvedCore; kind: "resolved" };

export class VoteResolutionService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => Date = () => new Date(),
    private readonly hooks: ResolutionHooks = {},
  ) {}

  async resolve(input: {
    choice: ResolutionChoice;
    publicBallotId: string;
    visitorId: bigint;
  }): Promise<ResolutionResponse> {
    const outcome = await withTransactionRetry(() =>
      this.database.transaction((transaction) => this.resolveInTransaction(transaction, input), {
        isolationLevel: "read committed",
      }),
    );

    if (outcome.kind === "expired") {
      throw new DomainError("BALLOT_EXPIRED", "Ballot has expired");
    }
    if (outcome.kind === "edition-inactive") {
      throw new DomainError("EDITION_NOT_ACTIVE", "The Ballot's Edition is no longer active");
    }

    return this.present(outcome.core);
  }

  private async resolveInTransaction(
    transaction: AppTransaction,
    input: {
      choice: ResolutionChoice;
      publicBallotId: string;
      visitorId: bigint;
    },
  ): Promise<TransactionOutcome> {
    const now = this.now();
    const [ballot] = await transaction
      .select()
      .from(ballots)
      .where(eq(ballots.publicId, input.publicBallotId))
      .for("update")
      .limit(1);

    if (!ballot || ballot.visitorId !== input.visitorId) {
      throw new DomainError("BALLOT_NOT_FOUND", "Ballot was not found for this visitor");
    }

    if (ballot.status === "RESOLVED") {
      const originalChoice = requireDomainValue(
        ballot.resolution,
        "BALLOT_RESOLUTION_MISSING",
        "Resolved Ballot has no stored resolution",
      );
      if (originalChoice !== input.choice) {
        throw new DomainError(
          "BALLOT_ALREADY_RESOLVED",
          "Ballot was already resolved with a different choice",
          { originalChoice },
        );
      }

      return {
        core: this.toCore(ballot, originalChoice, true),
        kind: "resolved",
      };
    }

    const [edition] = await transaction
      .select({ status: editions.status })
      .from(editions)
      .where(eq(editions.id, ballot.editionId))
      .for("share")
      .limit(1);
    const editionStatus = requireDomainValue(
      edition,
      "EDITION_NOT_FOUND",
      "Ballot Edition does not exist",
    ).status;

    if (ballot.status === "EXPIRED") {
      return { kind: editionStatus === "ACTIVE" ? "expired" : "edition-inactive" };
    }

    if (editionStatus !== "ACTIVE") {
      await transaction.update(ballots).set({ status: "EXPIRED" }).where(eq(ballots.id, ballot.id));
      return { kind: "edition-inactive" };
    }

    if (ballot.expiresAt <= now) {
      await transaction.update(ballots).set({ status: "EXPIRED" }).where(eq(ballots.id, ballot.id));
      return { kind: "expired" };
    }

    const voteStatus = mapEligibilityToVoteStatus(ballot.rankingEligibility);
    const choicePlayers = resolveChoicePlayers(
      input.choice,
      ballot.leftPlayerId,
      ballot.rightPlayerId,
    );
    const [vote] = await transaction
      .insert(votes)
      .values({
        ballotId: ballot.id,
        choice: input.choice,
        editionId: ballot.editionId,
        ipRiskKey: ballot.issuedIpRiskKey,
        loserPlayerId: choicePlayers.loserPlayerId,
        status: voteStatus,
        visitorId: ballot.visitorId,
        winnerPlayerId: choicePlayers.winnerPlayerId,
      })
      .returning({ id: votes.id });
    requireDomainValue(vote, "VOTE_CREATE_FAILED", "Vote insertion returned no row");
    await this.hooks.afterVoteInsert?.();

    const isValid = voteStatus === "VALID";
    const isSkip = input.choice === "SKIP";
    const chosenCanonicalPlayerId = choicePlayers.winnerPlayerId;
    const player1Chosen = chosenCanonicalPlayerId === ballot.player1Id;
    const player2Chosen = chosenCanonicalPlayerId === ballot.player2Id;

    await transaction
      .insert(pairAggregates)
      .values({
        countedPlayer1Wins: isValid && player1Chosen ? 1n : 0n,
        countedPlayer2Wins: isValid && player2Chosen ? 1n : 0n,
        countedSkips: isValid && isSkip ? 1n : 0n,
        editionId: ballot.editionId,
        observedPlayer1Choices: !isSkip && player1Chosen ? 1n : 0n,
        observedPlayer2Choices: !isSkip && player2Chosen ? 1n : 0n,
        observedSkips: isSkip ? 1n : 0n,
        player1Id: ballot.player1Id,
        player2Id: ballot.player2Id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pairAggregates.editionId, pairAggregates.player1Id, pairAggregates.player2Id],
        set: {
          countedPlayer1Wins: sql`${pairAggregates.countedPlayer1Wins} + ${isValid && player1Chosen ? 1 : 0}`,
          countedPlayer2Wins: sql`${pairAggregates.countedPlayer2Wins} + ${isValid && player2Chosen ? 1 : 0}`,
          countedSkips: sql`${pairAggregates.countedSkips} + ${isValid && isSkip ? 1 : 0}`,
          observedPlayer1Choices: sql`${pairAggregates.observedPlayer1Choices} + ${!isSkip && player1Chosen ? 1 : 0}`,
          observedPlayer2Choices: sql`${pairAggregates.observedPlayer2Choices} + ${!isSkip && player2Chosen ? 1 : 0}`,
          observedSkips: sql`${pairAggregates.observedSkips} + ${isSkip ? 1 : 0}`,
          updatedAt: now,
        },
      });

    if (isValid) {
      await this.updateRankings(transaction, ballot, input.choice, choicePlayers, now);
    }

    const usageSet =
      voteStatus === "VALID"
        ? {
            validResolved: sql`${visitorDailyUsage.validResolved} + 1`,
            ...(isSkip ? { validSkips: sql`${visitorDailyUsage.validSkips} + 1` } : {}),
          }
        : voteStatus === "THROTTLED"
          ? { throttledResolved: sql`${visitorDailyUsage.throttledResolved} + 1` }
          : { suspiciousResolved: sql`${visitorDailyUsage.suspiciousResolved} + 1` };
    const [usage] = await transaction
      .update(visitorDailyUsage)
      .set(usageSet)
      .where(
        and(
          eq(visitorDailyUsage.visitorId, ballot.visitorId),
          eq(visitorDailyUsage.editionId, ballot.editionId),
          eq(visitorDailyUsage.usageDate, ballot.usageDate),
        ),
      )
      .returning({ visitorId: visitorDailyUsage.visitorId });
    requireDomainValue(
      usage,
      "VISITOR_USAGE_NOT_FOUND",
      "Ballot has no matching visitor daily usage row",
    );

    const [resolved] = await transaction
      .update(ballots)
      .set({ resolution: input.choice, resolvedAt: now, status: "RESOLVED" })
      .where(eq(ballots.id, ballot.id))
      .returning();

    return {
      core: this.toCore(
        requireDomainValue(
          resolved,
          "BALLOT_RESOLVE_FAILED",
          "Ballot resolution update returned no row",
        ),
        input.choice,
        false,
      ),
      kind: "resolved",
    };
  }

  private async updateRankings(
    transaction: AppTransaction,
    ballot: typeof ballots.$inferSelect,
    choice: ResolutionChoice,
    choicePlayers: { loserPlayerId: bigint | null; winnerPlayerId: bigint | null },
    now: Date,
  ): Promise<void> {
    const rows = await transaction
      .select({ playerId: playerRankings.playerId })
      .from(playerRankings)
      .where(
        and(
          eq(playerRankings.editionId, ballot.editionId),
          inArray(playerRankings.playerId, [ballot.player1Id, ballot.player2Id]),
        ),
      )
      .orderBy(asc(playerRankings.playerId))
      .for("update");
    if (rows.length !== 2) {
      throw new DomainError(
        "RANKING_ROWS_MISSING",
        "Both Ballot players require ranking rows before resolution",
      );
    }

    for (const [index, row] of rows.entries()) {
      if (choice === "SKIP") {
        await transaction
          .update(playerRankings)
          .set({ skips: sql`${playerRankings.skips} + 1`, updatedAt: now })
          .where(
            and(
              eq(playerRankings.editionId, ballot.editionId),
              eq(playerRankings.playerId, row.playerId),
            ),
          );
      } else if (row.playerId === choicePlayers.winnerPlayerId) {
        await transaction
          .update(playerRankings)
          .set({
            score: sql`${playerRankings.score} + 1`,
            updatedAt: now,
            wins: sql`${playerRankings.wins} + 1`,
          })
          .where(
            and(
              eq(playerRankings.editionId, ballot.editionId),
              eq(playerRankings.playerId, row.playerId),
            ),
          );
      } else if (row.playerId === choicePlayers.loserPlayerId) {
        await transaction
          .update(playerRankings)
          .set({
            losses: sql`${playerRankings.losses} + 1`,
            score: sql`${playerRankings.score} - 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(playerRankings.editionId, ballot.editionId),
              eq(playerRankings.playerId, row.playerId),
            ),
          );
      } else {
        throw new DomainError(
          "BALLOT_PLAYER_MISMATCH",
          "Ballot ranking players do not match choice",
        );
      }

      if (index === 0) {
        await this.hooks.afterFirstRankingUpdate?.();
      }
    }
  }

  private toCore(
    ballot: typeof ballots.$inferSelect,
    choice: ResolutionChoice,
    alreadyResolved: boolean,
  ): ResolvedCore {
    return {
      alreadyResolved,
      ballotId: ballot.id,
      choice,
      editionId: ballot.editionId,
      leftPlayerId: ballot.leftPlayerId,
      player1Id: ballot.player1Id,
      player2Id: ballot.player2Id,
      rightPlayerId: ballot.rightPlayerId,
    };
  }

  private async present(core: ResolvedCore): Promise<ResolutionResponse> {
    const [vote, aggregate, rankingRows] = await Promise.all([
      this.database
        .select({ status: votes.status })
        .from(votes)
        .where(eq(votes.ballotId, core.ballotId))
        .limit(1),
      this.database
        .select()
        .from(pairAggregates)
        .where(
          and(
            eq(pairAggregates.editionId, core.editionId),
            eq(pairAggregates.player1Id, core.player1Id),
            eq(pairAggregates.player2Id, core.player2Id),
          ),
        )
        .limit(1),
      this.database
        .select({
          losses: playerRankings.losses,
          playerId: playerRankings.playerId,
          score: playerRankings.score,
          skips: playerRankings.skips,
          wins: playerRankings.wins,
        })
        .from(playerRankings)
        .where(eq(playerRankings.editionId, core.editionId)),
    ]);
    const storedVote = requireDomainValue(
      vote[0],
      "RESOLVED_VOTE_NOT_FOUND",
      "Resolved Ballot has no Vote",
    );
    const storedAggregate = requireDomainValue(
      aggregate[0],
      "PAIR_AGGREGATE_NOT_FOUND",
      "Resolved Ballot has no PairAggregate",
    );
    const rankings = rankPlayerRows(rankingRows);

    return {
      headToHead: buildHeadToHead(storedAggregate, core.leftPlayerId),
      left: requireDomainValue(
        rankings.get(core.leftPlayerId),
        "RANKING_ROW_NOT_FOUND",
        "Left Ballot player has no ranking row",
      ),
      resolution: {
        alreadyResolved: core.alreadyResolved,
        choice: core.choice,
        counted: storedVote.status === "VALID",
        voteStatus: storedVote.status,
      },
      right: requireDomainValue(
        rankings.get(core.rightPlayerId),
        "RANKING_ROW_NOT_FOUND",
        "Right Ballot player has no ranking row",
      ),
    };
  }
}
