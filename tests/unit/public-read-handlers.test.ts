import { describe, expect, it, vi } from "vitest";

import { createPlayerHandler } from "@/app/api/v1/players/[slug]/handler";
import { createRankingsHandler } from "@/app/api/v1/rankings/handler";
import type { PublicPlayerProfile, PublicRanking } from "@/domain/public/types";

const ranking: PublicRanking = {
  edition: { code: "2026", name: "2026 Edition", status: "ACTIVE" },
  players: [],
  updatedAt: null,
};

const player: PublicPlayerProfile = {
  careerRating: null,
  country: "CN",
  freshness: "MISSING",
  hltvProfileUrl: null,
  nickname: "Player",
  photoUrl: null,
  professionalStatus: "ACTIVE",
  ranking: null,
  realName: null,
  recentMaps: null,
  recentRating: null,
  slug: "player",
  statsCapturedAt: null,
  team: null,
  teamLogoUrl: null,
  teamShortName: null,
};

describe("public read API handlers", () => {
  it("serves the current ranking with a short public cache policy", async () => {
    const loadRanking = vi.fn().mockResolvedValue(ranking);
    const response = await createRankingsHandler({ loadRanking })();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=15, stale-while-revalidate=45",
    );
    await expect(response.json()).resolves.toEqual(ranking);
  });

  it("does not leak an unexpected ranking failure", async () => {
    const onUnexpectedError = vi.fn();
    const response = await createRankingsHandler({
      loadRanking: vi.fn().mockRejectedValue(new Error("database credentials")),
      onUnexpectedError,
    })();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: { code: "RANKING_UNAVAILABLE", message: "Ranking is temporarily unavailable" },
    });
    expect(onUnexpectedError).toHaveBeenCalledOnce();
  });

  it("validates player slugs before loading a profile", async () => {
    const loadPlayer = vi.fn();
    const response = await createPlayerHandler({ loadPlayer })("../private");

    expect(response.status).toBe(400);
    expect(loadPlayer).not.toHaveBeenCalled();
  });

  it("distinguishes a missing player and a cacheable public profile", async () => {
    const loadPlayer = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(player);
    const handler = createPlayerHandler({ loadPlayer });

    const missing = await handler("missing-player");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");

    const found = await handler("player");
    expect(found.status).toBe(200);
    expect(found.headers.get("cache-control")).toBe(
      "public, max-age=30, stale-while-revalidate=90",
    );
    await expect(found.json()).resolves.toEqual(player);
  });
});
