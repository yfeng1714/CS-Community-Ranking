import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createAdminMutationHandler } from "@/app/api/v1/admin/mutate/handler";
import { parseEnv } from "@/config/env";
import type { AppDatabase } from "@/domain/database";
import type { CandidatePoolService } from "@/domain/pool/service";

const env = parseEnv({
  ADMIN_SESSION_SECRET: "a".repeat(32),
  APP_ORIGIN: "https://ranking.example",
  DATABASE_URL: "postgresql://user:password@localhost:5432/database",
  IP_HMAC_SECRET: "b".repeat(32),
  NODE_ENV: "production",
  VISITOR_TOKEN_HASH_PEPPER: "c".repeat(32),
});

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://ranking.example/api/v1/admin/mutate", {
    body: JSON.stringify({
      action: "pool.pairing",
      editionId: "1",
      enabled: false,
      playerId: "2",
      reason: "Owner requested temporary exclusion",
    }),
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
});
