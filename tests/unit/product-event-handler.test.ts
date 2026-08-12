import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createProductEventHandler } from "@/app/api/v1/events/handler";

function request(body: unknown): NextRequest {
  return new NextRequest("https://ranking.example/api/v1/events", {
    body: typeof body === "string" ? body : JSON.stringify(body),
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
    recordEvent: vi.fn().mockResolvedValue(undefined),
    riskMonitor: {
      assess: vi.fn().mockResolvedValue({ ipRiskKey: null, reasonCodes: [] }),
      inspect: vi.fn().mockReturnValue({ infrastructureLimit: null, ipRiskKey: null }),
      recordResolutionFailure: vi.fn().mockResolvedValue(undefined),
    },
    visitorCookieName: "__Host-csr_visitor",
    visitors: { find: vi.fn().mockResolvedValue(null) },
  };
}

describe("POST /api/v1/events", () => {
  it("stores an allowlisted anonymous event without creating visitor identity", async () => {
    const deps = dependencies();
    const response = await createProductEventHandler(deps)(
      request({ eventType: "PAGE_VIEW", metadata: { page: "about" } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(deps.recordEvent).toHaveBeenCalledWith({
      eventType: "PAGE_VIEW",
      metadata: { page: "about" },
      visitorId: null,
    });
  });

  it("rejects arbitrary metadata before database work", async () => {
    const deps = dependencies();
    const response = await createProductEventHandler(deps)(
      request({ eventType: "VOTE_RESULT_VIEW", metadata: { choice: "LEFT" } }),
    );
    expect(response.status).toBe(400);
    expect(deps.recordEvent).not.toHaveBeenCalled();
  });
});
