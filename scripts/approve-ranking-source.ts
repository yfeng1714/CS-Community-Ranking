import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { closeDatabasePool, getDatabase } from "../src/db/client.ts";
import { adminUsers, rankingSourceSnapshots } from "../src/db/schema/index.ts";
import { DomainError, requireDomainValue } from "../src/domain/error.ts";
import { approveRankingSourceSnapshot } from "../src/domain/external-data/snapshots.ts";
import { normalizedRankingSnapshotSchema } from "../src/domain/external-data/types.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-ranking-source": { type: "boolean" },
    reason: { type: "string" },
    snapshot: { type: "string" },
  },
  strict: true,
}).values;

const snapshotIdText = args.snapshot?.trim();
if (!snapshotIdText || !/^\d+$/.test(snapshotIdText)) {
  throw new DomainError("CLI_OPTION_REQUIRED", "--snapshot must be a positive integer");
}
const snapshotId = BigInt(snapshotIdText);
const database = getDatabase();
try {
  const [stored] = await database
    .select()
    .from(rankingSourceSnapshots)
    .where(eq(rankingSourceSnapshots.id, snapshotId))
    .limit(1);
  const current = requireDomainValue(
    stored,
    "RANKING_SNAPSHOT_NOT_FOUND",
    `Ranking snapshot ${snapshotId} not found`,
  );
  const parsed = normalizedRankingSnapshotSchema.parse(current.normalizedData);
  const summary = {
    approvedAt: current.approvedAt?.toISOString() ?? null,
    capturedAt: current.capturedAt.toISOString(),
    checksum: current.rawChecksum,
    parserVersion: current.parserVersion,
    provider: current.provider,
    publishedAt: parsed.publishedAt,
    snapshotId: current.id.toString(),
    sourceUrl: parsed.sourceUrl,
    teams: parsed.teams.length,
  };

  if (!args.apply || current.approvedAt) {
    process.stdout.write(
      `${JSON.stringify({ mode: current.approvedAt ? "ALREADY_APPROVED" : "REVIEW", ...summary })}\n`,
    );
  } else {
    if (args["confirm-ranking-source"] !== true) {
      throw new DomainError(
        "RANKING_SOURCE_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-ranking-source",
      );
    }
    const actorUsername = args.actor?.trim();
    const reason = args.reason?.trim();
    if (!actorUsername || !reason) {
      throw new DomainError(
        "CLI_OPTION_REQUIRED",
        "--actor and --reason are required with --apply",
      );
    }
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
    const approved = await approveRankingSourceSnapshot(database, {
      actorAdminUserId: currentActor.id,
      reason,
      snapshotId,
    });
    process.stdout.write(
      `${JSON.stringify({ mode: "APPROVED", ...summary, approvedAt: approved.approvedAt?.toISOString() ?? null })}\n`,
    );
  }
} finally {
  await closeDatabasePool();
}
