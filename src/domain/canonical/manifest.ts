import { readFile } from "node:fs/promises";

import { z } from "zod";

import { DomainError } from "@/domain/error";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableText = z.string().trim().min(1).nullable();
const isoDate = z.iso.date();

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
  countryCode: z.string().trim().length(2).nullable(),
  hltvIdentity: hltvIdentitySchema,
  logoPath: nullableText,
  name: z.string().trim().min(1).max(200),
  players: z.array(playerSchema).length(5),
  shortName: nullableText,
  slug,
});

export const canonicalManifestSchema = z
  .strictObject({
    edition: z.strictObject({
      ballotTtlMinutes: z.int().positive(),
      code: z.string().regex(/^\d{4}$/),
      endsAt: z.iso.datetime({ offset: true }),
      fullWeightBallotsPerDay: z.int().nonnegative(),
      name: z.string().trim().min(1).max(200),
      startsAt: z.iso.datetime({ offset: true }),
    }),
    notes: z.array(z.string().trim().min(1).max(2_000)),
    observedAt: isoDate,
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
    if (new Date(manifest.edition.endsAt) <= new Date(manifest.edition.startsAt)) {
      context.addIssue({
        code: "custom",
        message: "Edition end must be after its start",
        path: ["edition", "endsAt"],
      });
    }

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

export type CanonicalManifest = z.infer<typeof canonicalManifestSchema>;

export async function loadCanonicalManifest(file: string): Promise<CanonicalManifest> {
  return canonicalManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

export function assertCanonicalManifestApproved(manifest: CanonicalManifest): void {
  if (
    manifest.review.status !== "OWNER_APPROVED" ||
    !manifest.review.approvedBy ||
    !manifest.review.reviewedAt
  ) {
    throw new DomainError(
      "CANONICAL_MANIFEST_NOT_APPROVED",
      "Canonical bootstrap requires an Owner-approved manifest",
    );
  }
}

export function summarizeCanonicalManifest(manifest: CanonicalManifest) {
  return {
    editionCode: manifest.edition.code,
    observedAt: manifest.observedAt,
    players: manifest.teams.reduce((count, team) => count + team.players.length, 0),
    reviewStatus: manifest.review.status,
    teams: manifest.teams.length,
  };
}
