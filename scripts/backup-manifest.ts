import { access, chmod, open, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  databaseIdentity,
  dumpMetadata,
  rowCounts,
  type BackupManifest,
} from "./backup-support.ts";
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
if (!dump.endsWith(".dump")) throw new Error("--dump must end in .dump");
const manifestPath = `${dump}.json`;
try {
  await access(manifestPath);
  throw new Error(`Refusing to overwrite existing manifest: ${manifestPath}`);
} catch (error) {
  if (error instanceof Error && "code" in error && error.code !== "ENOENT") throw error;
}

const handle = await open(dump, "r");
try {
  const header = Buffer.alloc(5);
  const result = await handle.read(header, 0, header.length, 0);
  if (result.bytesRead !== header.length || header.toString("ascii") !== "PGDMP") {
    throw new Error("--dump must be a PostgreSQL custom-format archive");
  }
} finally {
  await handle.close();
}
await chmod(dump, 0o600);

const manifest: BackupManifest = {
  createdAt: new Date().toISOString(),
  database: databaseIdentity(databaseUrl),
  format: "pg_dump-custom",
  rowCounts: await rowCounts(databaseUrl),
  schemaVersion: 1,
  ...(await dumpMetadata(dump)),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ dump, manifest: manifestPath, status: "created" }));
