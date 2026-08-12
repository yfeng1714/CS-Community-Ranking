import { describe, expect, it } from "vitest";

import {
  buildHeadToHead,
  mapEligibilityToVoteStatus,
  rankPlayerRows,
  resolveChoicePlayers,
} from "@/domain/votes/presentation";

describe("vote presentation primitives", () => {
  it("maps issuance eligibility to persisted Vote status", () => {
    expect(mapEligibilityToVoteStatus("ELIGIBLE")).toBe("VALID");
    expect(mapEligibilityToVoteStatus("THROTTLED")).toBe("THROTTLED");
    expect(mapEligibilityToVoteStatus("SUSPICIOUS")).toBe("SUSPICIOUS");
  });

  it("maps left, right, and skip without accepting client player IDs", () => {
    expect(resolveChoicePlayers("LEFT", 10n, 20n)).toEqual({
      loserPlayerId: 20n,
      winnerPlayerId: 10n,
    });
    expect(resolveChoicePlayers("RIGHT", 10n, 20n)).toEqual({
      loserPlayerId: 10n,
      winnerPlayerId: 20n,
    });
    expect(resolveChoicePlayers("SKIP", 10n, 20n)).toEqual({
      loserPlayerId: null,
      winnerPlayerId: null,
    });
  });

  it("returns nullable percentages for zero decisions and preserves counted skips", () => {
    expect(
      buildHeadToHead(
        {
          countedPlayer1Wins: 0n,
          countedPlayer2Wins: 0n,
          countedSkips: 4n,
          player1Id: 10n,
        },
        10n,
      ),
    ).toEqual({
      countedDecisions: 0,
      countedSkips: 4,
      leftWinPercent: null,
      rightWinPercent: null,
    });
  });

  it("orients canonical aggregate results to the displayed left player", () => {
    expect(
      buildHeadToHead(
        {
          countedPlayer1Wins: 3n,
          countedPlayer2Wins: 1n,
          countedSkips: 2n,
          player1Id: 10n,
        },
        20n,
      ),
    ).toEqual({
      countedDecisions: 4,
      countedSkips: 2,
      leftWinPercent: 0.25,
      rightWinPercent: 0.75,
    });
  });

  it("assigns competition ranks with deterministic player ordering inside ties", () => {
    const ranked = rankPlayerRows([
      { losses: 1n, playerId: 30n, score: 0, skips: 0n, wins: 1n },
      { losses: 0n, playerId: 20n, score: 2, skips: 1n, wins: 2n },
      { losses: 0n, playerId: 10n, score: 2, skips: 0n, wins: 2n },
      { losses: 2n, playerId: 40n, score: -1, skips: 0n, wins: 1n },
    ]);

    expect(ranked.get(10n)?.rank).toBe(1);
    expect(ranked.get(20n)?.rank).toBe(1);
    expect(ranked.get(30n)?.rank).toBe(3);
    expect(ranked.get(40n)?.rank).toBe(4);
  });
});
