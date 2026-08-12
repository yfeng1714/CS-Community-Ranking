import type { IssuedBallotResponse } from "@/domain/ballots/service";

import { PublicApiError, type VotingApi } from "./api";

export const RELOAD_BALLOT_STORAGE_KEY = "csr-reload-skip-ballot";

export interface ReloadMarkerStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

function canContinueAfterSkipError(error: unknown): boolean {
  return (
    error instanceof PublicApiError &&
    ["BALLOT_ALREADY_RESOLVED", "BALLOT_EXPIRED", "EDITION_NOT_ACTIVE"].includes(error.code)
  );
}

export async function loadBallotForNavigation(input: {
  api: VotingApi;
  isReload: boolean;
  storage: ReloadMarkerStorage;
}): Promise<IssuedBallotResponse> {
  const first = await input.api.next();
  const storedReloadBallotId = input.storage.getItem(RELOAD_BALLOT_STORAGE_KEY);

  if (storedReloadBallotId && storedReloadBallotId !== first.ballot.id) {
    input.storage.removeItem(RELOAD_BALLOT_STORAGE_KEY);
    return first;
  }

  const shouldSkip =
    (storedReloadBallotId === first.ballot.id || input.isReload) && first.reusedOpenBallot;
  if (!shouldSkip) {
    return first;
  }

  input.storage.setItem(RELOAD_BALLOT_STORAGE_KEY, first.ballot.id);
  try {
    await input.api.resolve(first.ballot.id, "SKIP");
  } catch (error) {
    if (!canContinueAfterSkipError(error)) {
      throw error;
    }
  }

  const replacement = await input.api.next();
  input.storage.removeItem(RELOAD_BALLOT_STORAGE_KEY);
  return replacement;
}

export function isBrowserReload(): boolean {
  const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return entry?.type === "reload";
}
