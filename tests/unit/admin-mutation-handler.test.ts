import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createAdminMutationHandler } from "@/app/api/v1/admin/mutate/handler";
import { parseEnv } from "@/config/env";
import type { AppDatabase } from "@/domain/database";
import type { CandidatePoolService } from "@/domain/pool/service";

const { checkLaunchReadiness, transitionEdition } = vi.hoisted(() => ({
  checkLaunchReadiness: vi.fn(),
  transitionEdition: vi.fn(),
}));

vi.mock("@/domain/launch/readiness", () => ({ checkLaunchReadiness }));
vi.mock("@/domain/editions/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domain/editions/service")>()),
  transitionEdition,
}));

const env = parseEnv({
  ADMIN_SESSION_SECRET: "a".repeat(32),
  APP_ORIGIN: "https://ranking.example",
  DATABASE_URL: "postgresql://user:password@localhost:5432/database",
  IP_HMAC_SECRET: "b".repeat(32),
  NODE_ENV: "production",
  VISITOR_TOKEN_HASH_PEPPER: "c".repeat(32),
});

function request(
  headers: Record<string, string> = {},
  body = JSON.stringify({
    action: "pool.pairing",
    editionId: "1",
    enabled: false,
    playerId: "2",
    reason: "Owner requested temporary exclusion",
  }),
) {
  return new NextRequest("https://ranking.example/api/v1/admin/mutate", {
    body,
    headers: {
      "content-type": "application/json",
      cookie: "__Host-csr_admin=opaque",
      origin: "https://ranking.example",
      ...headers,
    },
    method: "POST",
  });
}

describe("admin mutation handler", () => {
  it("rejects cross-origin JSON before session or domain work", async () => {
    const authenticate = vi.fn();
    const pairing = vi.fn();
    const response = await createAdminMutationHandler({
      database: {} as AppDatabase,
      env,
      pool: { setPairingEnabled: pairing } as unknown as CandidatePoolService,
      sessions: { authenticate },
    })(request({ origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
    expect(pairing).not.toHaveBeenCalled();
  });

  it("rejects missing or invalid sessions", async () => {
    const response = await createAdminMutationHandler({
      database: {} as AppDatabase,
      env,
      pool: {} as CandidatePoolService,
      sessions: { authenticate: async () => null },
    })(request());
    expect(response.status).toBe(401);
  });

  it("injects the authenticated actor into a validated mutation", async () => {
    const pairing = vi.fn().mockResolvedValue({ changed: true });
    const expiresAt = new Date("2026-01-01T12:00:00.000Z");
    const response = await createAdminMutationHandler({
      database: {} as AppDatabase,
      env,
      pool: { setPairingEnabled: pairing } as unknown as CandidatePoolService,
      sessions: {
        authenticate: async () => ({
          adminUserId: 9n,
          expiresAt,
          sessionId: 4n,
          username: "owner",
        }),
      },
    })(request());
    expect(response.status).toBe(200);
    expect(pairing).toHaveBeenCalledWith({
      action: "pool.pairing",
      actorAdminUserId: 9n,
      editionId: 1n,
      enabled: false,
      playerId: 2n,
      reason: "Owner requested temporary exclusion",
    });
  });

  it("returns 400 for malformed JSON and rejects unknown mutation fields", async () => {
    const expiresAt = new Date("2026-01-01T12:00:00.000Z");
    const pairing = vi.fn();
    const dependencies = {
      database: {} as AppDatabase,
      env,
      pool: { setPairingEnabled: pairing } as unknown as CandidatePoolService,
      sessions: {
        authenticate: async () => ({
          adminUserId: 9n,
          expiresAt,
          sessionId: 4n,
          username: "owner",
        }),
      },
    };

    const malformed = await createAdminMutationHandler(dependencies)(request({}, "{"));
    const extraField = await createAdminMutationHandler(dependencies)(
      request(
        {},
        JSON.stringify({
          action: "pool.pairing",
          editionId: "1",
          enabled: false,
          playerId: "2",
          reason: "Owner requested temporary exclusion",
          unrecognized: true,
        }),
      ),
    );
    const outOfRangeId = await createAdminMutationHandler(dependencies)(
      request(
        {},
        JSON.stringify({
          action: "pool.pairing",
          editionId: "9223372036854775808",
          enabled: false,
          playerId: "2",
          reason: "Owner requested temporary exclusion",
        }),
      ),
    );

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: "INVALID_ADMIN_JSON" } });
    expect(extraField.status).toBe(400);
    expect(outOfRangeId.status).toBe(400);
    expect(pairing).not.toHaveBeenCalled();
  });

  it("fails closed before Admin Edition activation when launch readiness has blockers", async () => {
    checkLaunchReadiness.mockResolvedValue({
      checks: [
        {
          code: "POOL_SOURCES_FRESH",
          details: {},
          message: "Approved Pool sources are stale",
          status: "BLOCK",
        },
      ],
    });
    const response = await createAdminMutationHandler({
      database: {} as AppDatabase,
      env,
      pool: {} as CandidatePoolService,
      sessions: {
        authenticate: async () => ({
          adminUserId: 9n,
          expiresAt: new Date("2026-01-01T12:00:00.000Z"),
          sessionId: 4n,
          username: "owner",
        }),
      },
    })(
      request(
        {},
        JSON.stringify({
          action: "edition.transition",
          editionId: "7",
          reason: "Owner requested production activation",
          status: "ACTIVE",
        }),
      ),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "EDITION_ACTIVATION_BLOCKED" },
    });
    expect(checkLaunchReadiness).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ editionId: 7n, expectedRiskMode: "observe", sourceMaxAgeDays: 14 }),
    );
    expect(transitionEdition).not.toHaveBeenCalled();
  });

  it("allows Admin Edition activation only after a blocker-free readiness report", async () => {
    checkLaunchReadiness.mockResolvedValue({ checks: [] });
    transitionEdition.mockResolvedValue({ id: 7n, status: "ACTIVE" });
    const response = await createAdminMutationHandler({
      database: {} as AppDatabase,
      env,
      pool: {} as CandidatePoolService,
      sessions: {
        authenticate: async () => ({
          adminUserId: 9n,
          expiresAt: new Date("2026-01-01T12:00:00.000Z"),
          sessionId: 4n,
          username: "owner",
        }),
      },
    })(
      request(
        {},
        JSON.stringify({
          action: "edition.transition",
          editionId: "7",
          reason: "Owner requested production activation",
          status: "ACTIVE",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(transitionEdition).toHaveBeenCalledWith(expect.anything(), {
      action: "edition.transition",
      actorAdminUserId: 9n,
      editionId: 7n,
      reason: "Owner requested production activation",
      status: "ACTIVE",
    });
  });
});
