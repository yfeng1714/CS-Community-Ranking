import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getEnv } from "@/config/env";
import * as schema from "@/db/schema";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

export function getPool(): Pool {
  pool ??= new Pool({
    connectionString: getEnv().DATABASE_URL,
    application_name: "cs-community-ranking-web",
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    max: 10,
  });

  return pool;
}

export function getDatabase(): NodePgDatabase<typeof schema> {
  database ??= drizzle(getPool(), { schema });
  return database;
}

export async function checkDatabaseReadiness(): Promise<void> {
  await getPool().query("select 1 as ready");
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    database = undefined;
  }
}
