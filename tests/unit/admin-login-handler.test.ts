import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createAdminLoginHandler } from "@/app/api/v1/admin/login/handler";
import { parseEnv } from "@/config/env";

const env = parseEnv({
  ADMIN_SESSION_SECRET: "a".repeat(32),
  APP_ORIGIN: "https://ranking.example",
  DATABASE_URL: "postgresql://user:password@localhost:5432/database",
  IP_HMAC_SECRET: "b".repeat(32),
  NODE_ENV: "production",
  VISITOR_TOKEN_HASH_PEPPER: "c".repeat(32),
});

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://ranking.example/api/v1/admin/login", {
    body: JSON.stringify({ password: "password", username: "owner" }),
    headers: {
      "content-type": "application/json",
      origin: "https://ranking.example",
      ...headers,
    },
    method: "POST",
  });
}

describe("admin login handler", () => {
  it("rejects cross-site requests before checking credentials", async () => {
    const login = vi.fn();
    const response = await createAdminLoginHandler({
      env,
      rateLimiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) },
      sessions: { login },
    })(request({ "sec-fetch-site": "cross-site" }));
    expect(response.status).toBe(403);
    expect(login).not.toHaveBeenCalled();
  });

  it("sets only a strict, secure, HttpOnly session cookie after success", async () => {
    const expiresAt = new Date("2026-01-01T12:00:00.000Z");
    const response = await createAdminLoginHandler({
      env,
      rateLimiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) },
      sessions: {
        login: async () => ({
          expiresAt,
          session: { adminUserId: 1n, expiresAt, sessionId: 2n, username: "owner" },
          token: "opaque-token",
        }),
      },
    })(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("__Host-csr_admin=opaque-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  });

  it("returns 429 without attempting password verification", async () => {
    const login = vi.fn();
    const response = await createAdminLoginHandler({
      env,
      rateLimiter: { check: () => ({ allowed: false, retryAfterSeconds: 30 }) },
      sessions: { login },
    })(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(login).not.toHaveBeenCalled();
  });
});
