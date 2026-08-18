import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { players } from "../src/db/schema/index.ts";
import { DomainError } from "../src/domain/error.ts";
import { updatePlayer } from "../src/domain/players/service.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import { loadSpecialRetiredManifest } from "../src/domain/pool/special-retired-manifest.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";
import { cliArgs } from "./cli-args.ts";
import { createPoolCliContext, printCliError } from "./pool-cli-support.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-player-photos": { type: "boolean" },
    edition: { type: "string" },
    "review-manual": { type: "string" },
    "special-retired": { type: "string" },
  },
  strict: true,
}).values;

try {
  const reviewManual = await loadReviewManualManifest(
    args["review-manual"] ?? "data/review-manual/2026-08-17.json",
  );
  const specialRetired = await loadSpecialRetiredManifest(
    args["special-retired"] ?? "data/review-manual/special-retired-2026-08-17.json",
  );
  const updates = [
    ...reviewManual.teams.flatMap((team) =>
      team.players.map((player) => ({ photoPath: player.photoPath, slug: player.slug })),
    ),
    ...specialRetired.players.map((player) => ({
      photoPath: player.photoPath,
      slug: player.slug,
    })),
  ].filter((player): player is { photoPath: string; slug: string } => player.photoPath !== null);

  if (!args.apply) {
    process.stdout.write(
      `${JSON.stringify({ mode: "DRY_RUN", players: updates.map((player) => player.slug) })}\n`,
    );
  } else {
    if (args["confirm-player-photos"] !== true) {
      throw new DomainError(
        "PLAYER_PHOTO_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-player-photos",
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
        const [player] = await context.database
          .select({ id: players.id, photoPath: players.photoPath, slug: players.slug })
          .from(players)
          .where(eq(players.slug, update.slug))
          .limit(1);
        if (!player) {
          throw new DomainError("PLAYER_NOT_FOUND", `Player ${update.slug} not found`);
        }
        if (player.photoPath === update.photoPath) {
          applied.push({ slug: update.slug, status: "unchanged" });
          continue;
        }
        await updatePlayer(context.database, {
          actorAdminUserId: references.actorAdminUserId,
          photoPath: update.photoPath,
          playerId: player.id,
          reason: "Attach Owner-accepted local HLTV profile portraits",
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
