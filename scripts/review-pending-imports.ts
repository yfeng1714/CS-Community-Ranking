import { parseArgs } from "node:util";

import { eq, inArray } from "drizzle-orm";

import { closeDatabasePool, getDatabase } from "../src/db/client.ts";
import { adminUsers, pendingImportChanges } from "../src/db/schema/index.ts";
import { PendingImportReviewService } from "../src/domain/admin/pending-imports.ts";
import { DomainError, requireDomainValue } from "../src/domain/error.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-pending-review": { type: "boolean" },
    decision: { type: "string", default: "APPROVE" },
    id: { type: "string", multiple: true },
    reason: { type: "string" },
  },
  strict: true,
}).values;

const idTexts = (args.id ?? [])
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean);
if (!idTexts.length || idTexts.some((value) => !/^[1-9]\d*$/.test(value))) {
  throw new DomainError(
    "CLI_OPTION_REQUIRED",
    "At least one positive --id is required; comma-separated values are accepted",
  );
}
const ids = [...new Set(idTexts)].map(BigInt);
const decision = args.decision?.trim().toUpperCase();
if (decision !== "APPROVE" && decision !== "REJECT") {
  throw new DomainError("CLI_OPTION_INVALID", "--decision must be APPROVE or REJECT");
}

const database = getDatabase();
try {
  const rows = await database
    .select()
    .from(pendingImportChanges)
    .where(inArray(pendingImportChanges.id, ids));
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const selected = ids.map((id) =>
    requireDomainValue(
      rowsById.get(id),
      "PENDING_IMPORT_NOT_FOUND",
      `Pending import ${id} not found`,
    ),
  );
  const proposals = selected.map((row) => ({
    changeType: row.changeType,
    conflictCodes: row.conflictCodes,
    id: row.id.toString(),
    status: row.status,
    target: row.targetExternalKey,
  }));

  if (!args.apply) {
    process.stdout.write(`${JSON.stringify({ decision, mode: "REVIEW", proposals })}\n`);
  } else {
    if (args["confirm-pending-review"] !== true) {
      throw new DomainError(
        "PENDING_REVIEW_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-pending-review",
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
    const unavailable = selected.filter((row) => row.status !== "PENDING");
    if (unavailable.length) {
      throw new DomainError(
        "PENDING_IMPORT_ALREADY_REVIEWED",
        `Selected imports are not pending: ${unavailable.map((row) => row.id).join(", ")}`,
      );
    }
    if (decision === "APPROVE") {
      const conflicted = selected.filter((row) => row.conflictCodes.length > 0);
      if (conflicted.length) {
        throw new DomainError(
          "PENDING_IMPORT_HAS_CONFLICTS",
          `Selected imports contain conflicts: ${conflicted.map((row) => row.id).join(", ")}`,
        );
      }
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

    const service = new PendingImportReviewService(database);
    const reviewed = [];
    for (const pendingChangeId of ids) {
      const result = await service.review({
        actorAdminUserId: currentActor.id,
        decision,
        pendingChangeId,
        reason,
      });
      reviewed.push({ id: result.id.toString(), status: result.status });
    }
    process.stdout.write(`${JSON.stringify({ decision, mode: "APPLIED", proposals, reviewed })}\n`);
  }
} finally {
  await closeDatabasePool();
}
