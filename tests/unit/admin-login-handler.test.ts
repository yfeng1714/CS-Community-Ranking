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

function request(
  headers: Record<string, string> = {},
  body = JSON.stringify({ password: "password", username: "owner" }),
) {
  return new NextRequest("https://ranking.example/api/v1/admin/login", {
    body,
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

  it("returns 400 for malformed JSON and unknown fields", async () => {
    const dependencies = {
      env,
      rateLimiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) },
      sessions: { login: vi.fn() },
    };
    const malformed = await createAdminLoginHandler(dependencies)(request({}, "{"));
    const extraField = await createAdminLoginHandler(dependencies)(
      request({}, JSON.stringify({ password: "password", rememberMe: true, username: "owner" })),
    );

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: "INVALID_ADMIN_JSON" } });
    expect(extraField.status).toBe(400);
    expect(dependencies.sessions.login).not.toHaveBeenCalled();
  });

  it("uses proxy identity headers only when explicitly trusted", async () => {
    const directCheck = vi.fn(() => ({ allowed: false, retryAfterSeconds: 30 }));
    await createAdminLoginHandler({
      env,
      rateLimiter: { check: directCheck },
      sessions: { login: vi.fn() },
    })(request({ "x-real-ip": "203.0.113.4" }));
    expect(directCheck).toHaveBeenCalledWith("direct");

    const proxyEnv = parseEnv({
      ADMIN_SESSION_SECRET: "a".repeat(32),
      APP_ORIGIN: "https://ranking.example",
      CLIENT_IP_MODE: "cloudflare",
      DATABASE_URL: "postgresql://user:password@localhost:5432/database",
      IP_HMAC_SECRET: "b".repeat(32),
      NODE_ENV: "production",
      TRUST_PROXY_HEADERS: "true",
      VISITOR_TOKEN_HASH_PEPPER: "c".repeat(32),
    });
    const proxyCheck = vi.fn((key: string) => ({
      allowed: key.length < 0,
      retryAfterSeconds: 30,
    }));
    await createAdminLoginHandler({
      env: proxyEnv,
      rateLimiter: { check: proxyCheck },
      sessions: { login: vi.fn() },
    })(request({ "cf-connecting-ip": "203.0.113.8", "x-real-ip": "spoofed" }));
    const key = proxyCheck.mock.calls[0]?.[0];
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(key).not.toContain("203.0.113.8");
  });
});
