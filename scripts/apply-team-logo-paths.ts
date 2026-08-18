import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { teams } from "../src/db/schema/index.ts";
import { DomainError } from "../src/domain/error.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";
import { updateTeam } from "../src/domain/teams/service.ts";
import { cliArgs } from "./cli-args.ts";
import { createPoolCliContext, printCliError } from "./pool-cli-support.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-team-logos": { type: "boolean" },
    edition: { type: "string" },
    "review-manual": { type: "string" },
  },
  strict: true,
}).values;

try {
  const reviewManual = await loadReviewManualManifest(
    args["review-manual"] ?? "data/review-manual/2026-08-17.json",
  );
  const updates = reviewManual.teams
    .map((team) => ({ logoPath: team.logoPath, slug: team.slug }))
    .filter((team): team is { logoPath: string; slug: string } => team.logoPath !== null);

  if (!args.apply) {
    process.stdout.write(
      `${JSON.stringify({ mode: "DRY_RUN", teams: updates.map((team) => team.slug) })}\n`,
    );
  } else {
    if (args["confirm-team-logos"] !== true) {
      throw new DomainError(
        "TEAM_LOGO_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-team-logos",
      );
    }
    const actorUsername = args.actor?.trim();
    if (!actorUsername) {
      throw new DomainError("CLI_OPTION_REQUIRED", "--actor is required with --apply");
    }
    const context = createPoolCliContext();
    try {
      const references = await resolvePoolCliReferences(context.database, {
        actorUsername,
        editionCode: args.edition?.trim() || reviewManual.editionCode,
      });
      const applied = [];
      for (const update of updates) {
        const [team] = await context.database
          .select({ id: teams.id, logoPath: teams.logoPath, slug: teams.slug })
          .from(teams)
          .where(eq(teams.slug, update.slug))
          .limit(1);
        if (!team) {
          throw new DomainError("TEAM_NOT_FOUND", `Team ${update.slug} not found`);
        }
        if (team.logoPath === update.logoPath) {
          applied.push({ slug: update.slug, status: "unchanged" });
          continue;
        }
        await updateTeam(context.database, {
          actorAdminUserId: references.actorAdminUserId,
          logoPath: update.logoPath,
          reason: "Attach Owner-accepted local HLTV team logos",
          teamId: team.id,
        });
        applied.push({ slug: update.slug, status: "updated" });
      }
      process.stdout.write(`${JSON.stringify({ mode: "APPLIED", applied })}\n`);
    } finally {
      await context.pool.end();
    }
  }
} catch (error) {
  printCliError(error);
}
