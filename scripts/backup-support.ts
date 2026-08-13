import { spawn } from "node:child_process";

import { Pool } from "pg";

export const criticalTables = [
  "edition",
  "player",
  "team",
  "roster_membership",
  "pool_player_entry",
  "anonymous_visitor",
  "ballot",
  "vote",
  "player_ranking",
  "pair_aggregate",
  "admin_user",
  "admin_audit_log",
  "pool_change_log",
  "moderation_audit_log",
] as const;

export interface BackupManifest {
  createdAt: string;
  database: string;
  format: "pg_dump-custom";
  rowCounts: Record<string, number>;
  schemaVersion: 1;
}

export function postgresCommand(urlValue: string): {
  args: string[];
  env: NodeJS.ProcessEnv;
} {
  const url = new URL(urlValue);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Database URL must use postgres:// or postgresql://");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database) throw new Error("Database URL must include a database name");
  return {
    args: [
      "--host",
      url.hostname,
      "--port",
      url.port || "5432",
      "--username",
      decodeURIComponent(url.username),
      "--dbname",
      database,
    ],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
  };
}

export function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} failed with ${signal ? `signal ${signal}` : `exit ${code}`}`));
    });
  });
}

export async function rowCounts(databaseUrl: string): Promise<Record<string, number>> {
  const pool = new Pool({
    application_name: "cs-community-ranking-backup-verification",
    connectionString: databaseUrl,
    max: 1,
  });
  try {
    const counts: Record<string, number> = {};
    for (const table of criticalTables) {
      const result = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${table}`,
      );
      counts[table] = Number(result.rows[0]?.count ?? 0);
    }
    return counts;
  } finally {
    await pool.end();
  }
}

export function databaseIdentity(value: string): string {
  const url = new URL(value);
  return `${url.hostname}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
}
