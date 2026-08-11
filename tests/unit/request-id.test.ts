import { describe, expect, it } from "vitest";

import { getOrCreateRequestId } from "@/observability/request-id";

describe("getOrCreateRequestId", () => {
  it("preserves a safe upstream request ID", () => {
    expect(getOrCreateRequestId("request-123")).toBe("request-123");
  });

  it("replaces an unsafe request ID", () => {
    const requestId = getOrCreateRequestId("unsafe request id\nlog injection");

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("creates a request ID when one is absent", () => {
    expect(getOrCreateRequestId(null)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
