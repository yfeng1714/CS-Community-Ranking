import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

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
  options: { output: { type: "string" } },
  strict: true,
}).values;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
const output = path.resolve(args.output ?? `backups/staging-${timestamp}.dump`);
if (!output.endsWith(".dump")) throw new Error("--output must end in .dump");
try {
  await access(output);
  throw new Error(`Refusing to overwrite existing backup: ${output}`);
} catch (error) {
  if (error instanceof Error && "code" in error && error.code !== "ENOENT") throw error;
}
await mkdir(path.dirname(output), { recursive: true });

const connection = postgresCommand(databaseUrl);
await runCommand(
  "pg_dump",
  [...connection.args, "--format=custom", "--no-owner", "--file", output],
  connection.env,
);
const manifest: BackupManifest = {
  createdAt: new Date().toISOString(),
  database: databaseIdentity(databaseUrl),
  format: "pg_dump-custom",
  rowCounts: await rowCounts(databaseUrl),
  schemaVersion: 1,
};
await writeFile(`${output}.json`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ dump: output, manifest: `${output}.json`, status: "created" }));
