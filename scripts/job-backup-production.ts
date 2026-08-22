import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BackupManifest } from "./backup-support.ts";

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

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function runNode(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString("utf8").trim());
      else {
        const message = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(`${path.basename(script)} failed (${code ?? "unknown"}): ${message}`));
      }
    });
  });
}

requiredEnvironment("DATABASE_URL");
requiredEnvironment("R2_BUCKET");
requiredEnvironment("R2_ENDPOINT");
requiredEnvironment("R2_ACCESS_KEY_ID");
requiredEnvironment("R2_SECRET_ACCESS_KEY");

const timestamp = shanghaiTimestamp();
const workingDirectory = await mkdtemp(path.join(tmpdir(), "csr-production-backup-"));
const dump = path.join(workingDirectory, `production-${timestamp.fileTimestamp}.dump`);

try {
  await runNode("scripts/backup-create.ts", ["--output", dump]);
  const upload = JSON.parse(
    await runNode("scripts/backup-upload-r2.ts", [
      "--dump",
      dump,
      "--prefix",
      `daily/${timestamp.date}`,
    ]),
  ) as { bucket: string; objects: { key: string; status: string }[]; status: string };
  const manifest = JSON.parse(await readFile(`${dump}.json`, "utf8")) as BackupManifest;
  console.log(
    JSON.stringify({
      backup: {
        createdAt: manifest.createdAt,
        dumpBytes: manifest.dumpBytes,
        rowCounts: manifest.rowCounts,
        sha256: manifest.sha256,
      },
      r2: upload,
      status: "ok",
    }),
  );
} finally {
  await rm(workingDirectory, { force: true, recursive: true });
}
