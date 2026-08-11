import { parseArgs } from "node:util";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema/index.ts";
import { DomainError } from "../src/domain/error.ts";
import { ActivePoolCache } from "../src/domain/pool/active-pool-cache.ts";
import { CandidatePoolService } from "../src/domain/pool/service.ts";

export function createPoolCliContext() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DomainError("DATABASE_URL_REQUIRED", "DATABASE_URL is required");
  }

  const cacheTtlSeconds = Number(process.env.ACTIVE_POOL_CACHE_TTL_SECONDS ?? "60");
  if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds <= 0) {
    throw new DomainError(
      "INVALID_CACHE_TTL",
      "ACTIVE_POOL_CACHE_TTL_SECONDS must be a positive integer",
    );
  }

  const pool = new Pool({
    application_name: "cs-community-ranking-pool-cli",
    connectionString,
    max: 2,
  });
  const database = drizzle(pool, { schema });
  const service = new CandidatePoolService(database, new ActivePoolCache(cacheTtlSeconds * 1000));

  return { database, pool, service };
}

export function parseRequiredOptions<const T extends Record<string, { type: "string" }>>(
  options: T,
): { [K in keyof T]: string } {
  const parsed = parseArgs({ options, strict: true }).values as Record<
    string,
    boolean | string | undefined
  >;
  const required = {} as { [K in keyof T]: string };

  for (const key of Object.keys(options) as (keyof T)[]) {
    const value = parsed[String(key)];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new DomainError("CLI_OPTION_REQUIRED", `--${String(key)} is required`);
    }
    required[key] = value.trim();
  }

  return required;
}

export function printCliError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown Pool CLI error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
