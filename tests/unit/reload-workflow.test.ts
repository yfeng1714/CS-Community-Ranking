import { describe, expect, it, vi } from "vitest";

import { PublicApiError, type VotingApi } from "@/components/vote/api";
import {
  loadBallotForNavigation,
  RELOAD_BALLOT_STORAGE_KEY,
  type ReloadMarkerStorage,
} from "@/components/vote/reload-workflow";
import type { IssuedBallotResponse } from "@/domain/ballots/service";

function issued(id: string, reusedOpenBallot: boolean, dailyOrdinal = 1): IssuedBallotResponse {
  const player = {
    careerRating: null,
    country: null,
    nickname: "Player",
    photoUrl: null,
    recentMaps: null,
    recentRating: null,
    slug: "player",
    statsCapturedAt: null,
    team: null,
  };
  return {
    ballot: {
      dailyOrdinal,
      expiresAt: "2026-08-12T01:30:00.000Z",
      id,
      issuedAt: "2026-08-12T01:00:00.000Z",
      left: player,
      rankingMode: "ELIGIBLE",
      right: { ...player, nickname: "Opponent", slug: "opponent" },
    },
    quota: { fullWeightLimit: 50, remainingEligibleBallots: 49 },
    reusedOpenBallot,
  };
}

function storage(initial?: string): ReloadMarkerStorage & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() {
      return this.value;
    },
    removeItem() {
      this.value = null;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
}

function api(nextResults: IssuedBallotResponse[]): VotingApi {
  return {
    next: vi.fn().mockImplementation(async () => {
      const result = nextResults.shift();
      if (!result) throw new Error("Unexpected next call");
      return result;
    }),
    resolve: vi.fn().mockResolvedValue({}),
  } as unknown as VotingApi;
}

describe("voting-page navigation workflow", () => {
  it("preserves an open Ballot during an ordinary render or retry", async () => {
    const open = issued("open-ballot", true);
    const votingApi = api([open]);

    await expect(
      loadBallotForNavigation({ api: votingApi, isReload: false, storage: storage() }),
    ).resolves.toBe(open);
    expect(votingApi.resolve).not.toHaveBeenCalled();
  });

  it("does not skip when a reload created a genuinely new Ballot", async () => {
    const fresh = issued("fresh-ballot", false);
    const votingApi = api([fresh]);

    await expect(
      loadBallotForNavigation({ api: votingApi, isReload: true, storage: storage() }),
    ).resolves.toBe(fresh);
    expect(votingApi.resolve).not.toHaveBeenCalled();
  });

  it("turns a manual reload of the same open Ballot into SKIP and returns the replacement", async () => {
    const open = issued("open-ballot", true);
    const replacement = issued("replacement-ballot", false, 2);
    const votingApi = api([open, replacement]);
    const marker = storage();

    await expect(
      loadBallotForNavigation({ api: votingApi, isReload: true, storage: marker }),
    ).resolves.toBe(replacement);
    expect(votingApi.resolve).toHaveBeenCalledWith("open-ballot", "SKIP");
    expect(marker.value).toBeNull();
  });

  it("resumes an interrupted reload Skip idempotently from its marker", async () => {
    const open = issued("open-ballot", true);
    const replacement = issued("replacement-ballot", false, 2);
    const votingApi = api([open, replacement]);

    await loadBallotForNavigation({
      api: votingApi,
      isReload: false,
      storage: storage("open-ballot"),
    });

    expect(votingApi.resolve).toHaveBeenCalledWith("open-ballot", "SKIP");
  });

  it("accepts an already-resolved Skip and continues to the next Ballot", async () => {
    const open = issued("open-ballot", true);
    const replacement = issued("replacement-ballot", false, 2);
    const votingApi = api([open, replacement]);
    vi.mocked(votingApi.resolve).mockRejectedValueOnce(
      new PublicApiError("BALLOT_ALREADY_RESOLVED", "already resolved", 409),
    );

    await expect(
      loadBallotForNavigation({ api: votingApi, isReload: true, storage: storage() }),
    ).resolves.toBe(replacement);
  });

  it("clears a stale marker without skipping the replacement Ballot", async () => {
    const replacement = issued("replacement-ballot", true, 2);
    const votingApi = api([replacement]);
    const marker = storage("old-ballot");

    await expect(
      loadBallotForNavigation({ api: votingApi, isReload: false, storage: marker }),
    ).resolves.toBe(replacement);
    expect(votingApi.resolve).not.toHaveBeenCalled();
    expect(marker.getItem(RELOAD_BALLOT_STORAGE_KEY)).toBeNull();
  });
});
