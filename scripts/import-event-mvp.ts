import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { and, eq, gte, isNull, sql } from "drizzle-orm";

import {
  eventMvpCandidates,
  eventMvpContests,
  playerExternalIdentities,
  players,
  rosterMemberships,
  teamExternalIdentities,
  teams,
} from "../src/db/schema/index.ts";
import { logoAssetPath } from "../src/domain/assets/hltv-team-logos.ts";
import { portraitAssetPath } from "../src/domain/assets/hltv-profile-portraits.ts";
import type { AppDatabase } from "../src/domain/database.ts";
import { DomainError } from "../src/domain/error.ts";
import {
  EVENT_MVP_BUNDLE_FILE,
  validateEventMvpBundle,
  type EventMvpBundle,
  type EventMvpRecord,
} from "../src/domain/event-mvp/bundle.ts";
import {
  upsertPlayerExternalIdentity,
  upsertTeamExternalIdentity,
} from "../src/domain/external-identities/service.ts";
import { createPlayer, updatePlayer } from "../src/domain/players/service.ts";
import { resolvePoolCliReferences } from "../src/domain/pool/service.ts";
import { createTeam, updateTeam } from "../src/domain/teams/service.ts";
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
  const file = path.resolve(args.file ?? EVENT_MVP_BUNDLE_FILE);
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

function publicAssetExists(assetPath: string): boolean {
  return existsSync(path.join(process.cwd(), "public", assetPath.replace(/^\//, "")));
}

async function importEventMvpBundle(
  database: AppDatabase,
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
  const RANK_SHIFT = 10_000;
  await database
    .update(eventMvpCandidates)
    .set({
      sourceRank: sql`${eventMvpCandidates.sourceRank} + ${RANK_SHIFT}`,
      updatedAt: new Date(),
    })
    .where(eq(eventMvpCandidates.contestId, contest.id));

  const keptRanks = new Set<number>();
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
    const photoPath = publicAssetExists(portraitAssetPath(record.slug))
      ? portraitAssetPath(record.slug)
      : null;
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
          ...(photoPath ? { photoPath } : {}),
          ...(record.realName ? { realName: record.realName } : {}),
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
    await fillEventOnlyIdentity(database, {
      actorAdminUserId,
      contestStartsAt: bundle.contest.startsAt,
      photoPath,
      playerId,
      record,
    });
    await database
      .insert(eventMvpCandidates)
      .values({
        contestId: contest.id,
        eventRating: record.eventRating,
        maps: record.maps,
        playerId,
        sourceRank: record.sourceRank,
        teamStanding: record.teamStanding,
      })
      .onConflictDoUpdate({
        target: [eventMvpCandidates.contestId, eventMvpCandidates.playerId],
        set: {
          eventRating: record.eventRating,
          maps: record.maps,
          sourceRank: record.sourceRank,
          teamStanding: record.teamStanding,
          updatedAt: new Date(),
        },
      });
    keptRanks.add(record.sourceRank);
    applied.push({ slug: record.slug, status });
  }

  const leftovers = await database
    .select({
      id: eventMvpCandidates.id,
      sourceRank: eventMvpCandidates.sourceRank,
    })
    .from(eventMvpCandidates)
    .where(
      and(eq(eventMvpCandidates.contestId, contest.id), gte(eventMvpCandidates.sourceRank, RANK_SHIFT)),
    );
  leftovers.sort((left, right) => left.sourceRank - right.sourceRank);
  for (const leftover of leftovers) {
    let rank = leftover.sourceRank - RANK_SHIFT;
    while (keptRanks.has(rank)) rank += 1;
    keptRanks.add(rank);
    await database
      .update(eventMvpCandidates)
      .set({ sourceRank: rank, updatedAt: new Date() })
      .where(eq(eventMvpCandidates.id, leftover.id));
  }

  return applied;
}

async function fillEventOnlyIdentity(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    contestStartsAt: string;
    photoPath: string | null;
    playerId: bigint;
    record: EventMvpRecord;
  },
) {
  const [player] = await database
    .select({
      photoPath: players.photoPath,
      realName: players.realName,
    })
    .from(players)
    .where(eq(players.id, input.playerId))
    .limit(1);
  if (!player) {
    throw new DomainError("PLAYER_NOT_FOUND", `Player ${input.record.slug} was not written`);
  }

  const photoUpdate = !player.photoPath && input.photoPath ? { photoPath: input.photoPath } : {};
  const realNameUpdate =
    !player.realName && input.record.realName ? { realName: input.record.realName } : {};
  if (photoUpdate.photoPath || realNameUpdate.realName) {
    await updatePlayer(database, {
      actorAdminUserId: input.actorAdminUserId,
      playerId: input.playerId,
      reason: "Fill Event MVP identity without pairing-pool admission",
      ...photoUpdate,
      ...realNameUpdate,
    });
  }

  const teamId = await ensureEventTeam(database, input.actorAdminUserId, input.record);
  if (!teamId) return;

  const [currentRoster] = await database
    .select({ id: rosterMemberships.id })
    .from(rosterMemberships)
    .where(and(eq(rosterMemberships.playerId, input.playerId), isNull(rosterMemberships.endsAt)))
    .limit(1);
  if (currentRoster) return;

  await database.insert(rosterMemberships).values({
    playerId: input.playerId,
    source: "EVENT_MVP",
    startsAt: input.contestStartsAt,
    status: "STARTER",
    teamId,
  });
}

async function ensureEventTeam(
  database: AppDatabase,
  actorAdminUserId: bigint,
  record: EventMvpRecord,
): Promise<bigint | null> {
  if (
    !record.teamSlug ||
    !record.teamExternalId ||
    !record.teamExternalSlug ||
    !record.teamCountryCode ||
    !record.teamShortName
  ) {
    return null;
  }

  const logoPath = publicAssetExists(logoAssetPath(record.teamSlug, "webp"))
    ? logoAssetPath(record.teamSlug, "webp")
    : null;
  const [byIdentity] = await database
    .select({ teamId: teamExternalIdentities.teamId })
    .from(teamExternalIdentities)
    .where(
      and(
        eq(teamExternalIdentities.provider, "HLTV"),
        eq(teamExternalIdentities.externalId, record.teamExternalId),
      ),
    )
    .limit(1);
  let teamId = byIdentity?.teamId;
  if (!teamId) {
    const [existing] = await database
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, record.teamSlug))
      .limit(1);
    if (existing) {
      teamId = existing.id;
    } else {
      const created = await createTeam(database, {
        actorAdminUserId,
        countryCode: record.teamCountryCode,
        ...(logoPath ? { logoPath } : {}),
        name: record.team,
        reason: "Create Event MVP team without pairing-pool admission",
        shortName: record.teamShortName,
        slug: record.teamSlug,
      });
      teamId = created.id;
    }
    await upsertTeamExternalIdentity(database, {
      actorAdminUserId,
      externalId: record.teamExternalId,
      externalSlug: record.teamExternalSlug,
      provider: "HLTV",
      reason: "Link Event MVP team to official HLTV identity",
      sourceUrl: `https://www.hltv.org/team/${record.teamExternalId}/${record.teamExternalSlug}`,
      teamId,
    });
  }

  if (logoPath) {
    const [team] = await database
      .select({ logoPath: teams.logoPath })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (team && !team.logoPath) {
      await updateTeam(database, {
        actorAdminUserId,
        logoPath,
        reason: "Fill Event MVP team logo without pairing-pool admission",
        teamId,
      });
    }
  }

  return teamId;
}
