import { readFile } from "node:fs/promises";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  playerExternalIdentities,
  players,
  poolTeamEntries,
  teamExternalIdentities,
  teams,
} from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError } from "../error.ts";
import {
  upsertPlayerExternalIdentity,
  upsertTeamExternalIdentity,
} from "../external-identities/service.ts";
import { createPlayer } from "../players/service.ts";
import { addRosterMembership } from "../rosters/service.ts";
import { createTeam, updateTeam } from "../teams/service.ts";
import { CandidatePoolService } from "./service.ts";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableText = z.string().trim().min(1).nullable();

const hltvIdentitySchema = z.strictObject({
  externalId: z.string().regex(/^[1-9]\d*$/),
  externalSlug: slug,
  sourceUrl: z.url({ protocol: /^https$/ }),
});

const playerSchema = z.strictObject({
  countryCode: z.string().trim().length(2).nullable(),
  hltvIdentity: hltvIdentitySchema,
  hltvProfileUrl: z.url({ protocol: /^https$/ }),
  nickname: z.string().trim().min(1).max(100),
  photoPath: nullableText,
  realName: nullableText,
  slug,
});

const teamSchema = z.strictObject({
  admissionReason: z.string().trim().min(3).max(500),
  countryCode: z.string().trim().length(2).nullable(),
  hltvIdentity: hltvIdentitySchema,
  logoPath: nullableText,
  name: z.string().trim().min(1).max(200),
  players: z.array(playerSchema).length(5),
  shortName: nullableText,
  slug,
});

export const reviewManualManifestSchema = z
  .strictObject({
    editionCode: z.string().regex(/^\d{4}$/),
    notes: z.array(z.string().trim().min(1).max(2_000)),
    observedAt: z.iso.date(),
    review: z.strictObject({
      approvedBy: nullableText,
      reviewedAt: z.iso.datetime({ offset: true }).nullable(),
      status: z.enum(["DRAFT", "OWNER_APPROVED"]),
    }),
    sources: z
      .array(
        z.strictObject({
          label: z.string().trim().min(1).max(200),
          publishedAt: z.iso.datetime({ offset: true }),
          url: z.url({ protocol: /^https$/ }),
        }),
      )
      .min(1),
    teams: z.array(teamSchema).min(1),
    version: z.literal(1),
  })
  .superRefine((manifest, context) => {
    if (
      manifest.review.status === "OWNER_APPROVED" &&
      (!manifest.review.approvedBy || !manifest.review.reviewedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Owner-approved manifests require approvedBy and reviewedAt",
        path: ["review"],
      });
    }

    const teamSlugs = new Set<string>();
    const teamHltvIds = new Set<string>();
    const playerSlugs = new Set<string>();
    const playerHltvIds = new Set<string>();

    manifest.teams.forEach((team, teamIndex) => {
      if (teamSlugs.has(team.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate Team slug ${team.slug}`,
          path: ["teams", teamIndex, "slug"],
        });
      }
      teamSlugs.add(team.slug);

      if (teamHltvIds.has(team.hltvIdentity.externalId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate Team HLTV ID ${team.hltvIdentity.externalId}`,
          path: ["teams", teamIndex, "hltvIdentity", "externalId"],
        });
      }
      teamHltvIds.add(team.hltvIdentity.externalId);

      const expectedTeamPath = `/team/${team.hltvIdentity.externalId}/${team.hltvIdentity.externalSlug}`;
      const teamUrl = new URL(team.hltvIdentity.sourceUrl);
      if (teamUrl.hostname !== "www.hltv.org" || teamUrl.pathname !== expectedTeamPath) {
        context.addIssue({
          code: "custom",
          message: `Team HLTV URL must be https://www.hltv.org${expectedTeamPath}`,
          path: ["teams", teamIndex, "hltvIdentity", "sourceUrl"],
        });
      }

      team.players.forEach((player, playerIndex) => {
        if (playerSlugs.has(player.slug)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate Player slug ${player.slug}`,
            path: ["teams", teamIndex, "players", playerIndex, "slug"],
          });
        }
        playerSlugs.add(player.slug);

        if (playerHltvIds.has(player.hltvIdentity.externalId)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate Player HLTV ID ${player.hltvIdentity.externalId}`,
            path: ["teams", teamIndex, "players", playerIndex, "hltvIdentity", "externalId"],
          });
        }
        playerHltvIds.add(player.hltvIdentity.externalId);

        const expectedPlayerUrl = `https://www.hltv.org/player/${player.hltvIdentity.externalId}/${player.hltvIdentity.externalSlug}`;
        if (
          player.hltvIdentity.sourceUrl !== expectedPlayerUrl ||
          player.hltvProfileUrl !== expectedPlayerUrl
        ) {
          context.addIssue({
            code: "custom",
            message: `Player HLTV URLs must both equal ${expectedPlayerUrl}`,
            path: ["teams", teamIndex, "players", playerIndex, "hltvProfileUrl"],
          });
        }
      });
    });
  });

export type ReviewManualManifest = z.infer<typeof reviewManualManifestSchema>;

export async function loadReviewManualManifest(file: string): Promise<ReviewManualManifest> {
  return reviewManualManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

export function assertReviewManualManifestApproved(manifest: ReviewManualManifest): void {
  if (
    manifest.review.status !== "OWNER_APPROVED" ||
    !manifest.review.approvedBy ||
    !manifest.review.reviewedAt
  ) {
    throw new DomainError(
      "REVIEW_MANUAL_MANIFEST_NOT_APPROVED",
      "Review Manual admission requires an Owner-approved manifest",
    );
  }
}

export function summarizeReviewManualManifest(manifest: ReviewManualManifest) {
  return {
    editionCode: manifest.editionCode,
    observedAt: manifest.observedAt,
    players: manifest.teams.reduce((count, team) => count + team.players.length, 0),
    reviewStatus: manifest.review.status,
    teams: manifest.teams.map((team) => team.slug),
  };
}

export async function createAndAdmitReviewManualTeams(
  database: AppDatabase,
  poolService: CandidatePoolService,
  input: {
    actorAdminUserId: bigint;
    editionId: bigint;
    manifest: ReviewManualManifest;
  },
) {
  assertReviewManualManifestApproved(input.manifest);

  const teamSlugs = input.manifest.teams.map((team) => team.slug);
  const playerSlugs = input.manifest.teams.flatMap((team) =>
    team.players.map((player) => player.slug),
  );
  const teamHltvIds = input.manifest.teams.map((team) => team.hltvIdentity.externalId);
  const playerHltvIds = input.manifest.teams.flatMap((team) =>
    team.players.map((player) => player.hltvIdentity.externalId),
  );
  const expectedTeamByHltv = new Map(
    input.manifest.teams.map((team) => [team.hltvIdentity.externalId, team.slug]),
  );
  const expectedPlayerByHltv = new Map(
    input.manifest.teams.flatMap((team) =>
      team.players.map((player) => [player.hltvIdentity.externalId, player.slug] as const),
    ),
  );

  const [existingTeams, existingPlayers, existingTeamIdentities, existingPlayerIdentities] =
    await Promise.all([
      database.select().from(teams).where(inArray(teams.slug, teamSlugs)),
      database.select().from(players).where(inArray(players.slug, playerSlugs)),
      database
        .select({
          externalId: teamExternalIdentities.externalId,
          teamId: teamExternalIdentities.teamId,
        })
        .from(teamExternalIdentities)
        .innerJoin(teams, eq(teams.id, teamExternalIdentities.teamId))
        .where(
          and(
            eq(teamExternalIdentities.provider, "HLTV"),
            inArray(teamExternalIdentities.externalId, teamHltvIds),
          ),
        ),
      database
        .select({
          externalId: playerExternalIdentities.externalId,
          playerId: playerExternalIdentities.playerId,
          slug: players.slug,
        })
        .from(playerExternalIdentities)
        .innerJoin(players, eq(players.id, playerExternalIdentities.playerId))
        .where(
          and(
            eq(playerExternalIdentities.provider, "HLTV"),
            inArray(playerExternalIdentities.externalId, playerHltvIds),
          ),
        ),
    ]);

  const teamsBySlug = new Map(existingTeams.map((row) => [row.slug, row]));
  const playersBySlug = new Map(existingPlayers.map((row) => [row.slug, row]));
  const conflicts: string[] = [];
  for (const row of existingTeamIdentities) {
    const expectedSlug = expectedTeamByHltv.get(row.externalId);
    const owner = existingTeams.find((team) => team.id === row.teamId);
    if (!expectedSlug || owner?.slug !== expectedSlug) {
      conflicts.push(`team HLTV ${row.externalId}`);
    }
  }
  for (const row of existingPlayerIdentities) {
    if (expectedPlayerByHltv.get(row.externalId) !== row.slug) {
      conflicts.push(`player HLTV ${row.externalId}`);
    }
  }
  if (conflicts.length > 0) {
    throw new DomainError(
      "REVIEW_MANUAL_IDENTITY_CONFLICT",
      `Review Manual admission refused because identities already exist: ${conflicts.join(", ")}`,
    );
  }

  const identityReason = `Owner-reviewed Review Manual identities observed ${input.manifest.observedAt}`;
  const rosterSource = `Owner-reviewed HLTV team-page observation ${input.manifest.observedAt}; historical join date not asserted`;
  const admitted = [];

  for (const teamInput of input.manifest.teams) {
    let team = teamsBySlug.get(teamInput.slug);
    if (team) {
      if (!team.active) {
        throw new DomainError("TEAM_NOT_ACTIVE", `Existing Team ${teamInput.slug} is inactive`);
      }
      if (team.countryCode !== teamInput.countryCode || team.shortName !== teamInput.shortName) {
        team = await updateTeam(database, {
          actorAdminUserId: input.actorAdminUserId,
          countryCode: teamInput.countryCode,
          reason: identityReason,
          shortName: teamInput.shortName,
          teamId: team.id,
        });
      }
    } else {
      team = await createTeam(database, {
        actorAdminUserId: input.actorAdminUserId,
        countryCode: teamInput.countryCode,
        logoPath: teamInput.logoPath,
        name: teamInput.name,
        reason: identityReason,
        shortName: teamInput.shortName,
        slug: teamInput.slug,
      });
    }
    await upsertTeamExternalIdentity(database, {
      actorAdminUserId: input.actorAdminUserId,
      externalId: teamInput.hltvIdentity.externalId,
      externalSlug: teamInput.hltvIdentity.externalSlug,
      provider: "HLTV",
      reason: identityReason,
      sourceUrl: teamInput.hltvIdentity.sourceUrl,
      teamId: team.id,
    });

    for (const playerInput of teamInput.players) {
      let player = playersBySlug.get(playerInput.slug);
      if (player) {
        if (player.professionalStatus !== "ACTIVE") {
          throw new DomainError(
            "STARTER_NOT_ACTIVE",
            `Existing Player ${playerInput.slug} is not ACTIVE`,
          );
        }
      } else {
        player = await createPlayer(database, {
          actorAdminUserId: input.actorAdminUserId,
          countryCode: playerInput.countryCode,
          hltvProfileUrl: playerInput.hltvProfileUrl,
          nickname: playerInput.nickname,
          photoPath: playerInput.photoPath,
          professionalStatus: "ACTIVE",
          realName: playerInput.realName,
          reason: identityReason,
          slug: playerInput.slug,
        });
      }
      await upsertPlayerExternalIdentity(database, {
        actorAdminUserId: input.actorAdminUserId,
        externalId: playerInput.hltvIdentity.externalId,
        externalSlug: playerInput.hltvIdentity.externalSlug,
        playerId: player.id,
        provider: "HLTV",
        reason: identityReason,
        sourceUrl: playerInput.hltvIdentity.sourceUrl,
      });
      await addRosterMembership(database, {
        actorAdminUserId: input.actorAdminUserId,
        playerId: player.id,
        reason: identityReason,
        source: rosterSource,
        startsAt: input.manifest.observedAt,
        status: "STARTER",
        teamId: team.id,
      });
    }

    const [alreadyAdmitted] = await database
      .select({ id: poolTeamEntries.id })
      .from(poolTeamEntries)
      .where(
        and(eq(poolTeamEntries.editionId, input.editionId), eq(poolTeamEntries.teamId, team.id)),
      )
      .limit(1);
    if (alreadyAdmitted) {
      admitted.push({ players: 0, slug: team.slug, teamId: team.id.toString(), reused: true });
      continue;
    }

    const admission = await poolService.admitManualTeam({
      actorAdminUserId: input.actorAdminUserId,
      editionId: input.editionId,
      reason: teamInput.admissionReason,
      teamId: team.id,
    });
    admitted.push({
      players: admission.admittedPlayerIds.length,
      slug: team.slug,
      teamId: team.id.toString(),
    });
  }

  return { admitted };
}
