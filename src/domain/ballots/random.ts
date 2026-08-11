import { randomInt as secureRandomInt } from "node:crypto";

import { DomainError } from "../error.ts";

export interface RandomPair {
  leftPlayerId: bigint;
  player1Id: bigint;
  player2Id: bigint;
  rightPlayerId: bigint;
}

export type RandomIndex = (exclusiveMaximum: number) => number;

export function selectRandomPair(
  playerIds: readonly bigint[],
  randomIndex: RandomIndex = secureRandomInt,
): RandomPair {
  if (playerIds.length < 2) {
    throw new DomainError("POOL_NOT_READY", "At least two active players are required");
  }

  const firstIndex = randomIndex(playerIds.length);
  const compressedSecondIndex = randomIndex(playerIds.length - 1);
  const secondIndex =
    compressedSecondIndex >= firstIndex ? compressedSecondIndex + 1 : compressedSecondIndex;
  const firstPlayerId = playerIds[firstIndex];
  const secondPlayerId = playerIds[secondIndex];

  if (
    firstPlayerId === undefined ||
    secondPlayerId === undefined ||
    firstPlayerId === secondPlayerId
  ) {
    throw new DomainError("INVALID_ACTIVE_POOL", "Active Pool IDs must be distinct");
  }

  const [player1Id, player2Id] =
    firstPlayerId < secondPlayerId
      ? [firstPlayerId, secondPlayerId]
      : [secondPlayerId, firstPlayerId];
  const canonicalOnLeft = randomIndex(2) === 0;

  return {
    leftPlayerId: canonicalOnLeft ? player1Id : player2Id,
    player1Id,
    player2Id,
    rightPlayerId: canonicalOnLeft ? player2Id : player1Id,
  };
}
