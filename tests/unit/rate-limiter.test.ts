import { describe, expect, it } from "vitest";

import { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";

describe("BoundedFixedWindowRateLimiter", () => {
  it("limits within a window and resets after expiry", () => {
    let now = 1_000;
    const limiter = new BoundedFixedWindowRateLimiter(2, 10, 60_000, () => now);

    expect(limiter.check("visitor").allowed).toBe(true);
    expect(limiter.check("visitor").allowed).toBe(true);
    expect(limiter.check("visitor")).toEqual({
      allowed: false,
      currentCount: 2,
      retryAfterSeconds: 60,
    });
    now += 60_000;
    expect(limiter.check("visitor").allowed).toBe(true);
  });

  it("evicts least-recently-used keys and never exceeds its configured bound", () => {
    const limiter = new BoundedFixedWindowRateLimiter(5, 2, 60_000, () => 1_000);

    limiter.check("oldest");
    limiter.check("recent");
    limiter.check("oldest");
    limiter.check("new");

    expect(limiter.size).toBe(2);
    expect(limiter.check("recent").allowed).toBe(true);
    expect(limiter.size).toBe(2);
  });
});
