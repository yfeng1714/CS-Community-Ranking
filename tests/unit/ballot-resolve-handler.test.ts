import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createResolveBallotHandler } from "@/app/api/v1/ballots/[publicId]/resolve/handler";
import { DomainError } from "@/domain/error";

const publicId = "5cdcae3c-0c67-4ee8-96f0-dfbb07a7ac25";
const resolutionResponse = {
  headToHead: {
    countedDecisions: 1,
    countedSkips: 0,
    leftWinPercent: 1,
    rightWinPercent: 0,
  },
  left: { losses: 0, rank: 1, score: 1, skips: 0, wins: 1 },
  resolution: {
    alreadyResolved: false,
    choice: "LEFT",
    counted: true,
    voteStatus: "VALID",
  },
  right: { losses: 1, rank: 2, score: -1, skips: 0, wins: 0 },
};

function request(body: string = JSON.stringify({ choice: "LEFT" })): NextRequest {
  return new NextRequest(`https://ranking.example/api/v1/ballots/${publicId}/resolve`, {
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://ranking.example",
      "sec-fetch-site": "same-origin",
    },
    method: "POST",
  });
}

function dependencies() {
  return {
    appOrigin: "https://ranking.example",
    production: true,
    rateLimiter: { check: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }) },
    resolution: { resolve: vi.fn().mockResolvedValue(resolutionResponse) },
    visitorCookieMaxAgeDays: 365,
    visitorCookieName: "__Host-csr_visitor",
    visitors: { resolve: vi.fn().mockResolvedValue({ id: 7n }) },
  };
}

describe("POST /api/v1/ballots/{publicId}/resolve handler", () => {
  it("validates JSON and choice before visitor or database work", async () => {
    const deps = dependencies();
    const invalidJson = await createResolveBallotHandler(deps)(request("{"), publicId);
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toMatchObject({ error: { code: "INVALID_JSON" } });

    const invalidChoice = await createResolveBallotHandler(deps)(
      request(JSON.stringify({ choice: "PLAYER_ID", extra: true })),
      publicId,
    );
    expect(invalidChoice.status).toBe(400);
    expect(deps.visitors.resolve).not.toHaveBeenCalled();
  });

  it("passes only the stored-orientation choice and visitor identity to the service", async () => {
    const deps = dependencies();
    const response = await createResolveBallotHandler(deps)(request(), publicId);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(deps.resolution.resolve).toHaveBeenCalledWith({
      choice: "LEFT",
      publicBallotId: publicId,
      visitorId: 7n,
    });
    await expect(response.json()).resolves.toEqual(resolutionResponse);
  });

  it("returns the original choice for a conflicting idempotency retry", async () => {
    const deps = dependencies();
    deps.resolution.resolve.mockRejectedValue(
      new DomainError("BALLOT_ALREADY_RESOLVED", "different choice", { originalChoice: "RIGHT" }),
    );
    const response = await createResolveBallotHandler(deps)(request(), publicId);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BALLOT_ALREADY_RESOLVED",
        message: "Ballot was already resolved with a different choice",
        originalChoice: "RIGHT",
      },
    });
  });

  it("returns Retry-After without calling resolution when rate limited", async () => {
    const deps = dependencies();
    deps.rateLimiter.check.mockReturnValue({ allowed: false, retryAfterSeconds: 9 });
    const response = await createResolveBallotHandler(deps)(request(), publicId);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("9");
    expect(deps.resolution.resolve).not.toHaveBeenCalled();
  });
});
