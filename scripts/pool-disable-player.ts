import { createPoolCliContext, parseRequiredOptions, printCliError } from "./pool-cli-support.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";

const context = createPoolCliContext();

try {
  const options = parseRequiredOptions({
    actor: { type: "string" },
    edition: { type: "string" },
    player: { type: "string" },
    reason: { type: "string" },
  });
  const references = await resolvePoolCliReferences(context.database, {
    actorUsername: options.actor,
    editionCode: options.edition,
    playerSlug: options.player,
  });
  const result = await context.service.setPairingEnabled({
    actorAdminUserId: references.actorAdminUserId,
    editionId: references.editionId,
    enabled: false,
    playerId: references.playerId!,
    reason: options.reason,
  });

  process.stdout.write(
    `${JSON.stringify({
      changed: result.changed,
      editionId: references.editionId.toString(),
      playerId: references.playerId!.toString(),
      status: "pairing-disabled",
    })}\n`,
  );
} catch (error) {
  printCliError(error);
} finally {
  await context.pool.end();
}
