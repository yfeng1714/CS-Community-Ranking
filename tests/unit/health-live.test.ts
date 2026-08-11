import { describe, expect, it } from "vitest";

import { createLivenessResponse } from "@/app/api/health/live/health";

describe("liveness health response", () => {
  it("returns an uncached 200 without exposing internal state", async () => {
    const response = createLivenessResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
