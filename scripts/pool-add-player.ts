import { createPoolCliContext, parseRequiredOptions, printCliError } from "./pool-cli-support.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";

const context = createPoolCliContext();

try {
  const options = parseRequiredOptions({
    actor: { type: "string" },
    edition: { type: "string" },
    nickname: { type: "string" },
    reason: { type: "string" },
    slug: { type: "string" },
  });
  const references = await resolvePoolCliReferences(context.database, {
    actorUsername: options.actor,
    editionCode: options.edition,
  });
  const result = await context.service.createAndAdmitSpecialPlayer({
    actorAdminUserId: references.actorAdminUserId,
    editionId: references.editionId,
    nickname: options.nickname,
    reason: options.reason,
    slug: options.slug,
  });

  process.stdout.write(
    `${JSON.stringify({
      editionId: references.editionId.toString(),
      playerId: result.player.id.toString(),
      poolEntryId: result.poolEntry.id.toString(),
      status: "admitted",
    })}\n`,
  );
} catch (error) {
  printCliError(error);
} finally {
  await context.pool.end();
}
