import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createNextBallotHandler } from "@/app/api/v1/ballots/next/handler";

const ballotResponse = {
  ballot: {
    dailyOrdinal: 1,
    expiresAt: "2026-08-11T01:30:00.000Z",
    id: "5cdcae3c-0c67-4ee8-96f0-dfbb07a7ac25",
    issuedAt: "2026-08-11T01:00:00.000Z",
    left: {},
    rankingMode: "ELIGIBLE",
    right: {},
  },
  quota: { fullWeightLimit: 50, remainingEligibleBallots: 49 },
  reusedOpenBallot: false,
};

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://ranking.example/api/v1/ballots/next", {
    headers: {
      "content-type": "application/json",
      origin: "https://ranking.example",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    method: "POST",
  });
}

function dependencies() {
  return {
    appOrigin: "https://ranking.example",
    ballotIssuance: { issue: vi.fn().mockResolvedValue(ballotResponse) },
    production: true,
    rateLimiter: { check: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }) },
    visitorCookieMaxAgeDays: 365,
    visitorCookieName: "__Host-csr_visitor",
    visitors: {
      resolve: vi.fn().mockResolvedValue({ id: 7n, tokenToSet: "a".repeat(43) }),
    },
  };
}

describe("POST /api/v1/ballots/next handler", () => {
  it("guards the request before visitor or database work", async () => {
    const deps = dependencies();
    const response = await createNextBallotHandler(deps)(
      request({ origin: "https://attacker.example" }),
    );

    expect(response.status).toBe(403);
    expect(deps.visitors.resolve).not.toHaveBeenCalled();
  });

  it("issues a no-store response and a secure HttpOnly visitor cookie", async () => {
    const deps = dependencies();
    const response = await createNextBallotHandler(deps)(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toMatch(/__Host-csr_visitor=/);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/Secure/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    expect(deps.ballotIssuance.issue).toHaveBeenCalledWith(7n);
    await expect(response.json()).resolves.toEqual(ballotResponse);
  });

  it("returns Retry-After when the infrastructure limiter rejects the request", async () => {
    const deps = dependencies();
    deps.rateLimiter.check.mockReturnValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await createNextBallotHandler(deps)(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(deps.ballotIssuance.issue).not.toHaveBeenCalled();
  });
});
