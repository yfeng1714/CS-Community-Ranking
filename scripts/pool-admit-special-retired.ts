import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { DomainError } from "../src/domain/error.ts";
import {
  createAndAdmitSpecialRetiredPlayers,
  loadSpecialRetiredManifest,
  summarizeSpecialRetiredManifest,
} from "../src/domain/pool/special-retired-manifest.ts";
import {
  importReviewedCareerRatings,
  validateReviewedCareerRatingBundle,
} from "../src/domain/external-data/reviewed-career-rating.ts";
import { cliArgs } from "./cli-args.ts";
import { createPoolCliContext, printCliError } from "./pool-cli-support.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-special-retired": { type: "boolean" },
    edition: { type: "string" },
    manifest: { type: "string" },
  },
  strict: true,
}).values;

try {
  const manifestFile = path.resolve(
    args.manifest ?? "data/review-manual/special-retired-2026-08-17.json",
  );
  const manifestBytes = await readFile(manifestFile);
  const manifest = await loadSpecialRetiredManifest(manifestFile);
  const checksum = createHash("sha256").update(manifestBytes).digest("hex");
  const summary = summarizeSpecialRetiredManifest(manifest);

  if (!args.apply) {
    process.stdout.write(
      `${JSON.stringify({ checksum, manifest: manifestFile, mode: "DRY_RUN", ...summary })}\n`,
    );
  } else {
    if (args["confirm-special-retired"] !== true) {
      throw new DomainError(
        "SPECIAL_RETIRED_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-special-retired",
      );
    }
    const actorUsername = args.actor?.trim();
    const editionCode = args.edition?.trim() || manifest.editionCode;
    if (!actorUsername) {
      throw new DomainError("CLI_OPTION_REQUIRED", "--actor is required with --apply");
    }
    if (editionCode !== manifest.editionCode) {
      throw new DomainError(
        "SPECIAL_RETIRED_EDITION_MISMATCH",
        `--edition ${editionCode} does not match manifest edition ${manifest.editionCode}`,
      );
    }

    const context = createPoolCliContext();
    try {
      const references = await resolvePoolCliReferences(context.database, {
        actorUsername,
        editionCode,
      });
      const result = await createAndAdmitSpecialRetiredPlayers(
        context.database,
        context.service,
        {
          actorAdminUserId: references.actorAdminUserId,
          editionId: references.editionId,
          manifest,
        },
      );
      const careerBundle = validateReviewedCareerRatingBundle({
        capturedAt: manifest.review.reviewedAt,
        notes: manifest.notes,
        provider: "HLTV",
        records: manifest.players.map((player) => ({
          rating: player.careerRating,
          slug: player.slug,
          sourceUrl: player.hltvProfileUrl,
        })),
        version: 1,
      });
      const career = await importReviewedCareerRatings(context.database, {
        actorAdminUserId: references.actorAdminUserId,
        bundle: careerBundle,
        checksum,
        reason: "Owner-reviewed frozen career Rating 3.0 for retired Special players",
      });
      process.stdout.write(
        `${JSON.stringify({
          checksum,
          editionId: references.editionId.toString(),
          mode: "APPLIED",
          ...result,
          career,
        })}\n`,
      );
    } finally {
      await context.pool.end();
    }
  }
} catch (error) {
  printCliError(error);
}
