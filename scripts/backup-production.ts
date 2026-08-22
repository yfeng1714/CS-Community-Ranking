import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, open, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { criticalTables, dumpMetadata, type BackupManifest } from "./backup-support.ts";

const project = process.env.RAILWAY_PROJECT_ID ?? "d3599e57-0191-4265-9cd2-04c9978ac665";
const environment = process.env.RAILWAY_ENVIRONMENT ?? "production";
const service = process.env.RAILWAY_DATABASE_SERVICE ?? "Postgres";
const railway = path.resolve("node_modules/.bin/railway");

function shanghaiTimestamp(now = new Date()): { date: string; fileTimestamp: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((values, part) => {
      if (part.type !== "literal") values[part.type] = part.value;
      return values;
    }, {});
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, fileTimestamp: `${date}T${parts.hour}${parts.minute}${parts.second}CST` };
}

async function runRailway(
  command: string[],
  options: { stdoutFile?: string } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      railway,
      ["ssh", "--project", project, "--service", service, "--environment", environment, ...command],
      { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    const standardError: Buffer[] = [];
    const standardOutput: Buffer[] = [];
    const outputStream = options.stdoutFile
      ? createWriteStream(options.stdoutFile, { flags: "wx", mode: 0o600 })
      : null;
    child.stdout.on("data", (chunk: Buffer) => {
      if (outputStream) outputStream.write(chunk);
      else standardOutput.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => standardError.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        outputStream?.end();
        const message = Buffer.concat(standardError).toString("utf8").trim();
        reject(new Error(`Railway command failed (${code ?? "unknown"}): ${message}`));
        return;
      }
      const finish = () => resolve(Buffer.concat(standardOutput).toString("utf8").trim());
      if (outputStream) outputStream.end(finish);
      else finish();
    });
  });
}

function countSql(): string {
  const unions = criticalTables.map(
    (table) =>
      `SELECT '${table}' AS table_name, count(*)::bigint AS row_count FROM public.${table}`,
  );
  return `SELECT json_object_agg(table_name, row_count ORDER BY table_name) FROM (${unions.join(
    " UNION ALL ",
  )}) AS counts;`;
}

async function requireCustomDump(file: string): Promise<void> {
  const handle = await open(file, "r");
  try {
    const header = Buffer.alloc(5);
    const result = await handle.read(header, 0, header.length, 0);
    if (result.bytesRead !== header.length || header.toString("ascii") !== "PGDMP") {
      throw new Error("Railway pg_dump did not produce a PostgreSQL custom archive");
    }
  } finally {
    await handle.close();
  }
}

const timestamp = shanghaiTimestamp();
const dump = path.resolve(`backups/production-${timestamp.fileTimestamp}.dump`);
const manifestPath = `${dump}.json`;
await mkdir(path.dirname(dump), { recursive: true });
try {
  await access(dump);
  throw new Error(`Refusing to overwrite existing backup: ${dump}`);
} catch (error) {
  if (error instanceof Error && "code" in error && error.code !== "ENOENT") throw error;
}

let dumpComplete = false;
try {
  await runRailway(["pg_dump", "--format=custom", "--no-owner"], { stdoutFile: dump });
  await requireCustomDump(dump);
  await chmod(dump, 0o600);
  dumpComplete = true;

  const countOutput = await runRailway([
    "psql",
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "--command",
    countSql(),
  ]);
  const parsedCounts = JSON.parse(countOutput) as Record<string, number | string>;
  const rowCounts = Object.fromEntries(
    criticalTables.map((table) => {
      const count = Number(parsedCounts[table]);
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(`Invalid production row count for ${table}`);
      }
      return [table, count];
    }),
  );
  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    database: `Railway/${environment}/${service}/railway`,
    format: "pg_dump-custom",
    rowCounts,
    schemaVersion: 1,
    ...(await dumpMetadata(dump)),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });

  const upload = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/backup-upload-r2.ts", "--dump", dump, "--prefix", `daily/${timestamp.date}`],
      { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString("utf8").trim());
      else reject(new Error(Buffer.concat(stderr).toString("utf8").trim()));
    });
  });

  console.log(
    JSON.stringify({ dump, manifest: manifestPath, r2: JSON.parse(upload), status: "ok" }),
  );
} catch (error) {
  if (!dumpComplete) await unlink(dump).catch(() => undefined);
  throw error;
}
