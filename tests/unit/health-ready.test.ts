import { describe, expect, it, vi } from "vitest";

import { createReadinessHandler } from "@/app/api/health/ready/health";

describe("readiness health handler", () => {
  it("returns ready when PostgreSQL responds", async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const response = await createReadinessHandler({ checkDatabase })();

    expect(checkDatabase).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ready" });
  });

  it("returns a detail-free 503 and reports the failure when PostgreSQL is unavailable", async () => {
    const databaseError = new Error("connection refused at secret-hostname");
    const checkDatabase = vi.fn().mockRejectedValue(databaseError);
    const onFailure = vi.fn();

    const response = await createReadinessHandler({ checkDatabase, onFailure })();

    expect(onFailure).toHaveBeenCalledWith(databaseError);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "not_ready" });
  });
});
