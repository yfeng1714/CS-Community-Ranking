import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { Pool } from "pg";

import {
  databaseIdentity,
  postgresCommand,
  rowCounts,
  runCommand,
  type BackupManifest,
} from "./backup-support.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: { dump: { type: "string" } },
  strict: true,
}).values;
if (!args.dump) throw new Error("--dump is required");
const dump = path.resolve(args.dump);
const sourceUrl = process.env.DATABASE_URL;
const restoreUrl = process.env.RESTORE_DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required to guard against restoring over source");
if (!restoreUrl) throw new Error("RESTORE_DATABASE_URL is required");
if (databaseIdentity(sourceUrl) === databaseIdentity(restoreUrl)) {
  throw new Error("RESTORE_DATABASE_URL must identify a database separate from DATABASE_URL");
}

const targetPool = new Pool({
  application_name: "cs-community-ranking-restore-guard",
  connectionString: restoreUrl,
  max: 1,
});
try {
  const existing = await targetPool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM pg_tables WHERE schemaname = 'public'",
  );
  if (Number(existing.rows[0]?.count ?? 0) !== 0) {
    throw new Error("Restore target is not empty; use a new scratch database");
  }
} finally {
  await targetPool.end();
}

const manifest = JSON.parse(await readFile(`${dump}.json`, "utf8")) as BackupManifest;
if (manifest.schemaVersion !== 1 || manifest.format !== "pg_dump-custom") {
  throw new Error("Unsupported or malformed backup manifest");
}
const connection = postgresCommand(restoreUrl);
const started = performance.now();
await runCommand(
  "pg_restore",
  [...connection.args, "--no-owner", "--exit-on-error", dump],
  connection.env,
);
const restoredCounts = await rowCounts(restoreUrl);
const mismatches = Object.entries(manifest.rowCounts).filter(
  ([table, expected]) => restoredCounts[table] !== expected,
);
if (mismatches.length > 0) {
  throw new Error(`Restored critical-table counts differ: ${JSON.stringify(mismatches)}`);
}
console.log(
  JSON.stringify({
    backupCreatedAt: manifest.createdAt,
    criticalTableCounts: restoredCounts,
    restoreDurationMs: Math.round(performance.now() - started),
    sourceDatabase: manifest.database,
    status: "verified",
    targetDatabase: databaseIdentity(restoreUrl),
  }),
);
