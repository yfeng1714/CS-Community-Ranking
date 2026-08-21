import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { and, eq } from "drizzle-orm";

import {
  eventMvpCandidates,
  eventMvpContests,
  playerExternalIdentities,
  players,
} from "../src/db/schema/index.ts";
import { DomainError } from "../src/domain/error.ts";
import { validateEventMvpBundle, type EventMvpBundle } from "../src/domain/event-mvp/bundle.ts";
import { upsertPlayerExternalIdentity } from "../src/domain/external-identities/service.ts";
import { createPlayer } from "../src/domain/players/service.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";
import { cliArgs } from "./cli-args.ts";
import { createPoolCliContext, printCliError } from "./pool-cli-support.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    actor: { type: "string" },
    apply: { type: "boolean" },
    "confirm-event-mvp": { type: "boolean" },
    edition: { type: "string" },
    file: { type: "string" },
  },
  strict: true,
}).values;

try {
  const file = path.resolve(args.file ?? "data/reviewed-sources/hltv-ewc-2026-top15.json");
  const bundle = validateEventMvpBundle(JSON.parse(await readFile(file, "utf8")) as unknown);
  const summary = {
    contest: bundle.contest.slug,
    mode: args.apply ? "APPLIED" : "DRY_RUN",
    players: bundle.records.map((record) => record.slug),
    sourceUrl: bundle.contest.sourceUrl,
  };
  if (!args.apply) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } else {
    if (args["confirm-event-mvp"] !== true) {
      throw new DomainError(
        "EVENT_MVP_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-event-mvp",
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
        editionCode: args.edition?.trim() || "2026",
      });
      const applied = await importEventMvpBundle(
        context.database,
        bundle,
        references.actorAdminUserId,
      );
      process.stdout.write(`${JSON.stringify({ ...summary, applied })}\n`);
    } finally {
      await context.pool.end();
    }
  }
} catch (error) {
  printCliError(error);
}

async function importEventMvpBundle(
  database: ReturnType<typeof createPoolCliContext>["database"],
  bundle: EventMvpBundle,
  actorAdminUserId: bigint,
) {
  const [contest] = await database
    .insert(eventMvpContests)
    .values({
      capturedAt: new Date(bundle.contest.capturedAt),
      endsAt: bundle.contest.endsAt,
      hltvEventId: bundle.contest.hltvEventId,
      name: bundle.contest.name,
      navLabel: bundle.contest.navLabel,
      slug: bundle.contest.slug,
      sourceUrl: bundle.contest.sourceUrl,
      startsAt: bundle.contest.startsAt,
      status: "ACTIVE",
    })
    .onConflictDoUpdate({
      target: eventMvpContests.slug,
      set: {
        capturedAt: new Date(bundle.contest.capturedAt),
        endsAt: bundle.contest.endsAt,
        hltvEventId: bundle.contest.hltvEventId,
        name: bundle.contest.name,
        navLabel: bundle.contest.navLabel,
        sourceUrl: bundle.contest.sourceUrl,
        startsAt: bundle.contest.startsAt,
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    })
    .returning({ id: eventMvpContests.id });
  if (!contest) {
    throw new DomainError("EVENT_MVP_CONTEST_FAILED", "Event MVP contest write returned no row");
  }

  const applied: Array<{ slug: string; status: "created" | "linked" }> = [];
  for (const record of bundle.records) {
    const [byIdentity] = await database
      .select({ playerId: playerExternalIdentities.playerId })
      .from(playerExternalIdentities)
      .where(
        and(
          eq(playerExternalIdentities.provider, "HLTV"),
          eq(playerExternalIdentities.externalId, record.externalId),
        ),
      )
      .limit(1);
    let playerId = byIdentity?.playerId;
    let status: "created" | "linked" = "linked";
    if (!playerId) {
      const [existing] = await database
        .select({ id: players.id })
        .from(players)
        .where(eq(players.slug, record.slug))
        .limit(1);
      if (existing) {
        playerId = existing.id;
      } else {
        const created = await createPlayer(database, {
          actorAdminUserId,
          countryCode: record.countryCode,
          hltvProfileUrl: `https://www.hltv.org/player/${record.externalId}/${record.externalSlug}`,
          nickname: record.nickname,
          reason: "Admit Event MVP candidate without pairing-pool admission",
          slug: record.slug,
        });
        playerId = created.id;
        status = "created";
      }
      await upsertPlayerExternalIdentity(database, {
        actorAdminUserId,
        externalId: record.externalId,
        externalSlug: record.externalSlug,
        playerId,
        provider: "HLTV",
        reason: "Link Event MVP candidate to official HLTV identity",
        sourceUrl: `https://www.hltv.org/player/${record.externalId}/${record.externalSlug}`,
      });
    }
    await database
      .insert(eventMvpCandidates)
      .values({
        contestId: contest.id,
        eventRating: record.eventRating,
        maps: record.maps,
        playerId,
        sourceRank: record.sourceRank,
      })
      .onConflictDoUpdate({
        target: [eventMvpCandidates.contestId, eventMvpCandidates.playerId],
        set: {
          eventRating: record.eventRating,
          maps: record.maps,
          sourceRank: record.sourceRank,
          updatedAt: new Date(),
        },
      });
    applied.push({ slug: record.slug, status });
  }
  return applied;
}
