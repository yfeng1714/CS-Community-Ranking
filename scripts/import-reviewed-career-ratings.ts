import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { closeDatabasePool, getDatabase } from "../src/db/client.ts";
import { adminUsers } from "../src/db/schema/index.ts";
import { DomainError, requireDomainValue } from "../src/domain/error.ts";
import {
  importReviewedCareerRatings,
  validateReviewedCareerRatingBundle,
} from "../src/domain/external-data/reviewed-career-rating.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-reviewed-career-rating": { type: "boolean" },
    file: { type: "string" },
    reason: { type: "string" },
  },
  strict: true,
}).values;

const sourceFile = path.resolve(args.file ?? "data/review-manual/career-ratings-2026-08-17.json");
const sourceBytes = await readFile(sourceFile);
const bundle = validateReviewedCareerRatingBundle(JSON.parse(sourceBytes.toString("utf8")));
const checksum = createHash("sha256").update(sourceBytes).digest("hex");
const summary = {
  capturedAt: bundle.capturedAt,
  checksum,
  file: sourceFile,
  players: bundle.records.map((record) => record.slug),
};

if (!args.apply) {
  process.stdout.write(`${JSON.stringify({ mode: "DRY_RUN", ...summary })}\n`);
} else {
  if (args["confirm-reviewed-career-rating"] !== true) {
    throw new DomainError(
      "REVIEWED_CAREER_RATING_CONFIRMATION_REQUIRED",
      "--apply also requires --confirm-reviewed-career-rating",
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

    const result = await importReviewedCareerRatings(database, {
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
