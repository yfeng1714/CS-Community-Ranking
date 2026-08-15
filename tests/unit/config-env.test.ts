import { describe, expect, it } from "vitest";

import { EnvironmentValidationError, parseEnv } from "@/config/env";

const validEnvironment = {
  NODE_ENV: "development",
  APP_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://csr:csr_local_dev_password@localhost:5432/csr",
  APP_TIME_ZONE: "Asia/Shanghai",
  VISITOR_TOKEN_HASH_PEPPER: "replace-with-at-least-32-random-characters",
  IP_HMAC_SECRET: "replace-with-a-different-32-character-secret",
  ADMIN_SESSION_SECRET: "replace-with-another-32-character-secret",
};

describe("parseEnv", () => {
  it("parses a valid environment and applies safe defaults", () => {
    const env = parseEnv(validEnvironment);

    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_TIME_ZONE).toBe("Asia/Shanghai");
    expect(env.DEFAULT_FULL_WEIGHT_BALLOTS_PER_DAY).toBe(150);
    expect(env.DEFAULT_BALLOT_TTL_MINUTES).toBe(30);
    expect(env.ACTIVE_POOL_CACHE_TTL_SECONDS).toBe(60);
    expect(env.BALLOT_NEXT_RATE_LIMIT_PER_MINUTE).toBe(30);
    expect(env.BALLOT_RESOLVE_RATE_LIMIT_PER_MINUTE).toBe(60);
    expect(env.PUBLIC_API_RATE_LIMIT_PER_MINUTE).toBe(300);
    expect(env.RISK_REQUEST_VELOCITY_PER_MINUTE).toBe(120);
    expect(env.RISK_IMPOSSIBLE_CLIENT_FLOW_PER_IP_PER_DAY).toBe(5);
    expect(env.ADMIN_SESSION_TTL_HOURS).toBe(12);
    expect(env.ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE).toBe(5);
    expect(env.RATE_LIMITER_MAX_KEYS).toBe(10_000);
    expect(env.TRUST_PROXY_HEADERS).toBe(false);
    expect(env.HLTV_SYNC_ENABLED).toBe(false);
    expect(env.EXTERNAL_SOURCE_MAX_AGE_DAYS).toBe(14);
    expect(env.EXTERNAL_STATS_STALE_AFTER_HOURS).toBe(48);
  });

  it("parses the string false as false instead of JavaScript truthiness", () => {
    const env = parseEnv({
      ...validEnvironment,
      TRUST_PROXY_HEADERS: "false",
      HLTV_SYNC_ENABLED: "false",
    });

    expect(env.TRUST_PROXY_HEADERS).toBe(false);
    expect(env.HLTV_SYNC_ENABLED).toBe(false);
  });

  it("fails when a required value is missing", () => {
    const missingDatabaseUrl: Record<string, unknown> = { ...validEnvironment };
    delete missingDatabaseUrl.DATABASE_URL;

    expect(() => parseEnv(missingDatabaseUrl)).toThrow(EnvironmentValidationError);
    expect(() => parseEnv(missingDatabaseUrl)).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        DATABASE_URL: "https://example.com/database",
      }),
    ).toThrow(/postgres or postgresql/);
  });

  it("rejects a different quota time zone", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        APP_TIME_ZONE: "UTC",
      }),
    ).toThrow(/APP_TIME_ZONE/);
  });

  it("rejects documented placeholder secrets in production", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        NODE_ENV: "production",
        APP_ORIGIN: "https://example.com",
      }),
    ).toThrow(/development placeholder/);
  });

  it("requires an HLTV user agent when sync is enabled", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        HLTV_SYNC_ENABLED: "true",
      }),
    ).toThrow(/HLTV_USER_AGENT/);
  });

  it("requires an explicit proxy header mode when proxy headers are trusted", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        TRUST_PROXY_HEADERS: "true",
      }),
    ).toThrow(/CLIENT_IP_MODE/);

    expect(
      parseEnv({
        ...validEnvironment,
        CLIENT_IP_MODE: "cloudflare",
        TRUST_PROXY_HEADERS: "true",
      }).CLIENT_IP_MODE,
    ).toBe("cloudflare");
  });
});
