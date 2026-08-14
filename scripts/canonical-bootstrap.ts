import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { adminUsers } from "../src/db/schema/index.ts";
import * as schema from "../src/db/schema/index.ts";
import { bootstrapCanonicalManifest } from "../src/domain/canonical/bootstrap.ts";
import {
  loadCanonicalManifest,
  summarizeCanonicalManifest,
} from "../src/domain/canonical/manifest.ts";
import { DomainError, requireDomainValue } from "../src/domain/error.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-canonical-bootstrap": { type: "boolean" },
    manifest: { type: "string" },
  },
  strict: true,
}).values;

const manifestFile = path.resolve(args.manifest ?? "data/canonical/2026-beta.json");
const manifestBytes = await readFile(manifestFile);
const manifest = await loadCanonicalManifest(manifestFile);
const checksum = createHash("sha256").update(manifestBytes).digest("hex");
const summary = summarizeCanonicalManifest(manifest);

if (!args.apply) {
  process.stdout.write(
    `${JSON.stringify({ checksum, manifest: manifestFile, mode: "DRY_RUN", ...summary })}\n`,
  );
} else {
  if (args["confirm-canonical-bootstrap"] !== true) {
    throw new DomainError(
      "CANONICAL_BOOTSTRAP_CONFIRMATION_REQUIRED",
      "--apply also requires --confirm-canonical-bootstrap",
    );
  }
  const actorUsername = args.actor?.trim();
  if (!actorUsername) {
    throw new DomainError("CLI_OPTION_REQUIRED", "--actor is required with --apply");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new DomainError("DATABASE_URL_REQUIRED", "DATABASE_URL is required");

  const pool = new Pool({
    application_name: "cs-community-ranking-canonical-bootstrap",
    connectionString: databaseUrl,
    max: 1,
  });
  try {
    const database = drizzle(pool, { schema });
    const [actor] = await database
      .select({ active: adminUsers.active, id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.username, actorUsername))
      .limit(1);
    const currentActor = requireDomainValue(
      actor,
      "ADMIN_NOT_FOUND",
      `Admin ${actorUsername} not found`,
    );
    if (!currentActor.active) {
      throw new DomainError("ADMIN_INACTIVE", `Admin ${actorUsername} is inactive`);
    }

    const result = await bootstrapCanonicalManifest(database, {
      actorAdminUserId: currentActor.id,
      manifest,
      reason: `Owner-approved canonical bootstrap ${checksum}`,
    });
    process.stdout.write(
      `${JSON.stringify({ checksum, manifest: manifestFile, mode: "APPLIED", ...result })}\n`,
    );
  } finally {
    await pool.end();
  }
}
