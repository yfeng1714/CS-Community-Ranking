import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { DomainError } from "../src/domain/error.ts";
import {
  createAndAdmitReviewManualTeams,
  loadReviewManualManifest,
  summarizeReviewManualManifest,
} from "../src/domain/pool/review-manual-manifest.ts";
import { cliArgs } from "./cli-args.ts";
import { createPoolCliContext, printCliError } from "./pool-cli-support.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-review-manual": { type: "boolean" },
    edition: { type: "string" },
    manifest: { type: "string" },
  },
  strict: true,
}).values;

try {
  const manifestFile = path.resolve(args.manifest ?? "data/review-manual/2026-08-17.json");
  const manifestBytes = await readFile(manifestFile);
  const manifest = await loadReviewManualManifest(manifestFile);
  const checksum = createHash("sha256").update(manifestBytes).digest("hex");
  const summary = summarizeReviewManualManifest(manifest);

  if (!args.apply) {
    process.stdout.write(
      `${JSON.stringify({ checksum, manifest: manifestFile, mode: "DRY_RUN", ...summary })}\n`,
    );
  } else {
    if (args["confirm-review-manual"] !== true) {
      throw new DomainError(
        "REVIEW_MANUAL_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-review-manual",
      );
    }
    const actorUsername = args.actor?.trim();
    const editionCode = args.edition?.trim() || manifest.editionCode;
    if (!actorUsername) {
      throw new DomainError("CLI_OPTION_REQUIRED", "--actor is required with --apply");
    }
    if (editionCode !== manifest.editionCode) {
      throw new DomainError(
        "REVIEW_MANUAL_EDITION_MISMATCH",
        `--edition ${editionCode} does not match manifest edition ${manifest.editionCode}`,
      );
    }

    const context = createPoolCliContext();
    try {
      const references = await resolvePoolCliReferences(context.database, {
        actorUsername,
        editionCode,
      });
      const result = await createAndAdmitReviewManualTeams(context.database, context.service, {
        actorAdminUserId: references.actorAdminUserId,
        editionId: references.editionId,
        manifest,
      });
      process.stdout.write(
        `${JSON.stringify({
          checksum,
          editionId: references.editionId.toString(),
          mode: "APPLIED",
          ...result,
        })}\n`,
      );
    } finally {
      await context.pool.end();
    }
  }
} catch (error) {
  printCliError(error);
}
