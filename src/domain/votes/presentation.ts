import { DomainError } from "../error.ts";

export type ResolutionChoice = "LEFT" | "RIGHT" | "SKIP";
export type VoteStatus = "VALID" | "THROTTLED" | "SUSPICIOUS" | "REVOKED";

export interface ChoicePlayers {
  loserPlayerId: bigint | null;
  winnerPlayerId: bigint | null;
}

export interface HeadToHeadResult {
  countedDecisions: number;
  countedSkips: number;
  leftWinPercent: number | null;
  rightWinPercent: number | null;
}

export interface RankingResult {
  losses: number;
  rank: number;
  score: number;
  skips: number;
  wins: number;
}

export interface ResolutionResponse {
  headToHead: HeadToHeadResult;
  left: RankingResult;
  resolution: {
    alreadyResolved: boolean;
    choice: ResolutionChoice;
    counted: boolean;
    voteStatus: VoteStatus;
  };
  right: RankingResult;
}

export function mapEligibilityToVoteStatus(
  eligibility: "ELIGIBLE" | "SUSPICIOUS" | "THROTTLED",
): Exclude<VoteStatus, "REVOKED"> {
  if (eligibility === "ELIGIBLE") {
    return "VALID";
  }
  return eligibility;
}

export function resolveChoicePlayers(
  choice: ResolutionChoice,
  leftPlayerId: bigint,
  rightPlayerId: bigint,
): ChoicePlayers {
  if (choice === "SKIP") {
    return { loserPlayerId: null, winnerPlayerId: null };
  }

  return choice === "LEFT"
    ? { loserPlayerId: rightPlayerId, winnerPlayerId: leftPlayerId }
    : { loserPlayerId: leftPlayerId, winnerPlayerId: rightPlayerId };
}

export function buildHeadToHead(
  aggregate: {
    countedPlayer1Wins: bigint;
    countedPlayer2Wins: bigint;
    countedSkips: bigint;
    player1Id: bigint;
  },
  leftPlayerId: bigint,
): HeadToHeadResult {
  const decisions = aggregate.countedPlayer1Wins + aggregate.countedPlayer2Wins;
  const leftWins =
    leftPlayerId === aggregate.player1Id
      ? aggregate.countedPlayer1Wins
      : aggregate.countedPlayer2Wins;
  const countedDecisions = toSafeNumber(decisions, "counted H2H decisions");

  return {
    countedDecisions,
    countedSkips: toSafeNumber(aggregate.countedSkips, "counted H2H skips"),
    leftWinPercent: countedDecisions === 0 ? null : Number(leftWins) / countedDecisions,
    rightWinPercent:
      countedDecisions === 0 ? null : Number(decisions - leftWins) / countedDecisions,
  };
}

export function rankPlayerRows(
  rows: readonly {
    losses: bigint;
    playerId: bigint;
    score: number;
    skips: bigint;
    wins: bigint;
  }[],
): Map<bigint, RankingResult> {
  const sorted = [...rows].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0;
  });
  const results = new Map<bigint, RankingResult>();
  let previousScore: number | undefined;
  let currentRank = 0;

  for (const [index, row] of sorted.entries()) {
    if (previousScore === undefined || row.score !== previousScore) {
      currentRank = index + 1;
      previousScore = row.score;
    }
    results.set(row.playerId, {
      losses: toSafeNumber(row.losses, "player losses"),
      rank: currentRank,
      score: row.score,
      skips: toSafeNumber(row.skips, "player skips"),
      wins: toSafeNumber(row.wins, "player wins"),
    });
  }

  return results;
}

export function toSafeNumber(value: bigint, label: string): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) {
    throw new DomainError("PUBLIC_COUNTER_OVERFLOW", `${label} exceeds the public numeric range`);
  }
  return converted;
}
