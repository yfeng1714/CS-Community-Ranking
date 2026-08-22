import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { dumpMetadata, rowCounts, type BackupManifest } from "./backup-support.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: { dump: { type: "string" } },
  strict: true,
}).values;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!args.dump) throw new Error("--dump is required");

const dump = path.resolve(args.dump);
const manifest = JSON.parse(await readFile(`${dump}.json`, "utf8")) as BackupManifest;
if (manifest.schemaVersion !== 1 || manifest.format !== "pg_dump-custom") {
  throw new Error("Unsupported backup manifest");
}

const metadata = await dumpMetadata(dump);
if (manifest.dumpBytes !== undefined && manifest.dumpBytes !== metadata.dumpBytes) {
  throw new Error("Backup size does not match its manifest");
}
if (manifest.sha256 !== undefined && manifest.sha256 !== metadata.sha256) {
  throw new Error("Backup SHA-256 does not match its manifest");
}

const restoredCounts = await rowCounts(databaseUrl);
const mismatches = Object.entries(manifest.rowCounts).filter(
  ([table, expected]) => restoredCounts[table] !== expected,
);
if (mismatches.length > 0) {
  throw new Error(
    `Restore verification failed: ${mismatches
      .map(([table, expected]) => `${table} expected ${expected}, got ${restoredCounts[table]}`)
      .join("; ")}`,
  );
}

console.log(
  JSON.stringify({
    dump,
    sha256: metadata.sha256,
    status: "verified",
    tableCount: Object.keys(manifest.rowCounts).length,
  }),
);
