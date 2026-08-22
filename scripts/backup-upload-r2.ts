import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { dumpMetadata, type BackupManifest } from "./backup-support.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    dump: { type: "string" },
    prefix: { default: "daily", type: "string" },
  },
  strict: true,
}).values;

if (!args.dump) throw new Error("--dump is required");
const dump = path.resolve(args.dump);
if (!dump.endsWith(".dump")) throw new Error("--dump must end in .dump");
const manifestPath = `${dump}.json`;
const prefix = args.prefix?.replace(/^\/+|\/+$/g, "");
if (!prefix || prefix.includes("..")) throw new Error("--prefix must be a safe nonempty R2 prefix");

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const bucket = requiredEnvironment("R2_BUCKET");
const client = new S3Client({
  credentials: {
    accessKeyId: requiredEnvironment("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironment("R2_SECRET_ACCESS_KEY"),
  },
  endpoint: requiredEnvironment("R2_ENDPOINT"),
  region: "auto",
});

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
if (manifest.schemaVersion !== 1 || manifest.format !== "pg_dump-custom") {
  throw new Error("Unsupported or malformed backup manifest");
}

const dumpDetails = await dumpMetadata(dump);
if (manifest.dumpBytes !== dumpDetails.dumpBytes || manifest.sha256 !== dumpDetails.sha256) {
  throw new Error("Backup size or SHA-256 does not match its manifest");
}

async function objectExistsExactly(key: string, bytes: number, sha256: string): Promise<boolean> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (head.ContentLength === bytes && head.Metadata?.sha256 === sha256) return true;
    throw new Error(`Refusing to overwrite nonmatching R2 object: ${key}`);
  } catch (error) {
    const status =
      error && typeof error === "object" && "$metadata" in error
        ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
        : undefined;
    if (status === 404) return false;
    throw error;
  }
}

async function uploadFile(
  file: string,
  contentType: string,
): Promise<{ key: string; status: string }> {
  const details = await dumpMetadata(file);
  const key = `${prefix}/${path.basename(file)}`;
  if (await objectExistsExactly(key, details.dumpBytes, details.sha256)) {
    return { key, status: "already-present" };
  }

  await client.send(
    new PutObjectCommand({
      Body: createReadStream(file),
      Bucket: bucket,
      ContentLength: details.dumpBytes,
      ContentType: contentType,
      Key: key,
      Metadata: { sha256: details.sha256 },
    }),
  );
  if (!(await objectExistsExactly(key, details.dumpBytes, details.sha256))) {
    throw new Error(`R2 verification failed after upload: ${key}`);
  }
  return { key, status: "uploaded" };
}

try {
  const objects = [
    await uploadFile(dump, "application/octet-stream"),
    await uploadFile(manifestPath, "application/json"),
  ];
  console.log(JSON.stringify({ bucket, objects, status: "verified" }));
} finally {
  client.destroy();
}
