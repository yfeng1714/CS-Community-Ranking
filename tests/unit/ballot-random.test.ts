import { describe, expect, it } from "vitest";

import { selectRandomPair } from "@/domain/ballots/random";

function sequenceRandom(values: readonly number[]) {
  let index = 0;
  return (maximum: number): number => {
    const value = values[index++];
    if (value === undefined || value < 0 || value >= maximum) {
      throw new Error(`Invalid test random value ${String(value)} for maximum ${maximum}`);
    }
    return value;
  };
}

describe("selectRandomPair", () => {
  it("maps the compressed second index around the first and stores a canonical pair", () => {
    expect(selectRandomPair([10n, 20n, 30n, 40n], sequenceRandom([2, 2, 0]))).toEqual({
      leftPlayerId: 30n,
      player1Id: 30n,
      player2Id: 40n,
      rightPlayerId: 40n,
    });
  });

  it("randomizes display orientation independently of pair selection", () => {
    expect(selectRandomPair([30n, 10n], sequenceRandom([0, 0, 1]))).toEqual({
      leftPlayerId: 30n,
      player1Id: 10n,
      player2Id: 30n,
      rightPlayerId: 10n,
    });
  });

  it("rejects a pool with fewer than two distinct IDs", () => {
    expect(() => selectRandomPair([1n])).toThrow(/At least two/);
    expect(() => selectRandomPair([1n, 1n], sequenceRandom([0, 0]))).toThrow(/distinct/);
  });
});
