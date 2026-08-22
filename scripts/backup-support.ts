import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";

import { Pool } from "pg";

export const criticalTables = [
  "admin_audit_log",
  "admin_session",
  "admin_user",
  "api_request_metric",
  "anonymous_visitor",
  "ballot",
  "daily_ranking_snapshot",
  "edition",
  "event",
  "event_mvp_candidate",
  "event_mvp_contest",
  "event_mvp_vote",
  "event_team_result",
  "moderation_audit_log",
  "pair_aggregate",
  "pending_import_change",
  "player",
  "player_external_identity",
  "player_ranking",
  "player_stat_snapshot",
  "pool_change_log",
  "pool_player_entry",
  "pool_team_entry",
  "product_event",
  "ranking_source_snapshot",
  "risk_observation",
  "roster_membership",
  "sync_run",
  "team",
  "team_external_identity",
  "visitor_daily_usage",
  "vote",
] as const;

export interface BackupManifest {
  createdAt: string;
  database: string;
  dumpBytes?: number;
  format: "pg_dump-custom";
  rowCounts: Record<string, number>;
  schemaVersion: 1;
  sha256?: string;
}

export async function dumpMetadata(file: string): Promise<{ dumpBytes: number; sha256: string }> {
  const details = await stat(file);
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return { dumpBytes: details.size, sha256: hash.digest("hex") };
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
