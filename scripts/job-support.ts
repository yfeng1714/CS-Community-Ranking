import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema/index.ts";
import { DomainError } from "../src/domain/error.ts";

export function createJobContext(applicationName: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DomainError("DATABASE_URL_REQUIRED", "DATABASE_URL is required");
  const pool = new Pool({ application_name: applicationName, connectionString, max: 2 });
  return { database: drizzle(pool, { schema }), pool };
}

export function printJobResult(result: unknown): void {
  process.stdout.write(
    `${JSON.stringify(result, (_, value) => (typeof value === "bigint" ? value.toString() : value))}\n`,
  );
}
