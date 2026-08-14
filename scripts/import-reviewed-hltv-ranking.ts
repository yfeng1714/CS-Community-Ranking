import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { adminUsers, rankingSourceSnapshots } from "../src/db/schema/index.ts";
import { closeDatabasePool, getDatabase } from "../src/db/client.ts";
import { requireDomainValue, DomainError } from "../src/domain/error.ts";
import {
  validateReviewedHltvRanking,
  REVIEWED_HLTV_RANKING_VERSION,
} from "../src/domain/external-data/reviewed-ranking.ts";
import {
  approveRankingSourceSnapshot,
  writeRankingSourceSnapshot,
} from "../src/domain/external-data/snapshots.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-reviewed-source": { type: "boolean" },
    file: { type: "string" },
    reason: { type: "string" },
  },
  strict: true,
}).values;

const sourceFile = path.resolve(
  args.file ?? "data/reviewed-sources/hltv-ranking-2026-08-10-top12.json",
);
const sourceBytes = await readFile(sourceFile);
const snapshot = validateReviewedHltvRanking(JSON.parse(sourceBytes.toString("utf8")));
const checksum = createHash("sha256").update(sourceBytes).digest("hex");
const summary = {
  checksum,
  file: sourceFile,
  publishedAt: snapshot.publishedAt,
  sourceUrl: snapshot.sourceUrl,
  teams: snapshot.teams.length,
};

if (!args.apply) {
  process.stdout.write(`${JSON.stringify({ mode: "DRY_RUN", ...summary })}\n`);
} else {
  if (args["confirm-reviewed-source"] !== true) {
    throw new DomainError(
      "REVIEWED_SOURCE_CONFIRMATION_REQUIRED",
      "--apply also requires --confirm-reviewed-source",
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

    const written = await writeRankingSourceSnapshot(database, {
      capturedAt: new Date(),
      checksum,
      parserVersion: REVIEWED_HLTV_RANKING_VERSION,
      provider: "HLTV",
      snapshot,
    });
    const [stored] = await database
      .select({ approvedAt: rankingSourceSnapshots.approvedAt })
      .from(rankingSourceSnapshots)
      .where(eq(rankingSourceSnapshots.id, written.id))
      .limit(1);
    if (!stored?.approvedAt) {
      await approveRankingSourceSnapshot(database, {
        actorAdminUserId: currentActor.id,
        reason,
        snapshotId: written.id,
      });
    }
    process.stdout.write(
      `${JSON.stringify({ mode: "APPLIED_AND_APPROVED", snapshotId: written.id.toString(), ...summary })}\n`,
    );
  } finally {
    await closeDatabasePool();
  }
}
