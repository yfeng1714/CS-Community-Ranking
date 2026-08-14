import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { closeDatabasePool, getDatabase } from "../src/db/client.ts";
import { adminUsers } from "../src/db/schema/index.ts";
import { DomainError, requireDomainValue } from "../src/domain/error.ts";
import {
  importReviewedHltvPlayerStats,
  validateReviewedHltvPlayerStats,
} from "../src/domain/external-data/reviewed-player-stats.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-reviewed-stats": { type: "boolean" },
    file: { type: "string" },
    reason: { type: "string" },
  },
  strict: true,
}).values;

const sourceFile = path.resolve(args.file ?? "data/reviewed-sources/hltv-player-stats-local.json");
const sourceBytes = await readFile(sourceFile);
const bundle = validateReviewedHltvPlayerStats(JSON.parse(sourceBytes.toString("utf8")));
const checksum = createHash("sha256").update(sourceBytes).digest("hex");
const summary = {
  capturedAt: bundle.capturedAt,
  careerSnapshots: bundle.records.filter((record) => record.career !== null).length,
  checksum,
  file: sourceFile,
  missingRecent: bundle.records.filter((record) => record.recent === null).length,
  periodEnd: bundle.periodEnd,
  periodStart: bundle.periodStart,
  playersReviewed: bundle.records.length,
  recentSnapshots: bundle.records.filter((record) => record.recent !== null).length,
};

if (!args.apply) {
  process.stdout.write(`${JSON.stringify({ mode: "DRY_RUN", ...summary })}\n`);
} else {
  if (args["confirm-reviewed-stats"] !== true) {
    throw new DomainError(
      "REVIEWED_STATS_CONFIRMATION_REQUIRED",
      "--apply also requires --confirm-reviewed-stats",
    );
  }
  const actorUsername = args.actor?.trim();
  const reason = args.reason?.trim();
  if (!actorUsername || !reason) {
    throw new DomainError("CLI_OPTION_REQUIRED", "--actor and --reason are required with --apply");
  }

  const database = getDatabase();
  try {
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
    if (!currentActor.active) throw new DomainError("ADMIN_INACTIVE", "Admin is inactive");

    const result = await importReviewedHltvPlayerStats(database, {
      actorAdminUserId: currentActor.id,
      bundle,
      checksum,
      reason,
    });
    process.stdout.write(`${JSON.stringify({ mode: "APPLIED", ...summary, ...result })}\n`);
  } finally {
    await closeDatabasePool();
  }
}
