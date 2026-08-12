import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearProviderCircuitsForTests, fetchProviderText } from "@/domain/external-data/fetch";

beforeEach(clearProviderCircuitsForTests);

describe("external provider fetch boundary", () => {
  it("validates content type and returns bounded text", async () => {
    const fetchImplementation = vi.fn(
      async () => new Response("fixture", { headers: { "content-type": "text/plain" } }),
    );
    await expect(
      fetchProviderText({
        allowedContentTypes: ["text/plain"],
        fetchImplementation,
        maxAttempts: 1,
        url: "https://example.com/data",
        userAgent: "test",
      }),
    ).resolves.toBe("fixture");
  });

  it("opens a host circuit after repeated failed calls", async () => {
    const fetchImplementation = vi.fn(async () => new Response("blocked", { status: 403 }));
    for (let index = 0; index < 3; index += 1)
      await expect(
        fetchProviderText({
          allowedContentTypes: ["text/plain"],
          fetchImplementation,
          maxAttempts: 1,
          now: () => 1_000,
          url: "https://provider.example/data",
          userAgent: "test",
        }),
      ).rejects.toThrow("403");
    await expect(
      fetchProviderText({
        allowedContentTypes: ["text/plain"],
        fetchImplementation,
        maxAttempts: 1,
        now: () => 1_000,
        url: "https://provider.example/data",
        userAgent: "test",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_CIRCUIT_OPEN" });
  });
});
