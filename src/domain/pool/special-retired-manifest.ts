import { readFile } from "node:fs/promises";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { poolPlayerEntries, players } from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError } from "../error.ts";
import { upsertPlayerExternalIdentity } from "../external-identities/service.ts";
import { createPlayer, updatePlayer } from "../players/service.ts";
import { CandidatePoolService } from "./service.ts";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableText = z.string().trim().min(1).nullable();

const playerSchema = z.strictObject({
  admissionReason: z.string().trim().min(3).max(500),
  careerRating: z.number().nonnegative().max(5),
  countryCode: z.string().trim().length(2),
  hltvIdentity: z.strictObject({
    externalId: z.string().regex(/^[1-9]\d*$/),
    externalSlug: slug,
    sourceUrl: z.url({ protocol: /^https$/ }),
  }),
  hltvProfileUrl: z.url({ protocol: /^https$/ }),
  nickname: z.string().trim().min(1).max(100),
  photoPath: nullableText,
  realName: nullableText,
  slug,
});

export const specialRetiredManifestSchema = z
  .strictObject({
    editionCode: z.string().regex(/^\d{4}$/),
    notes: z.array(z.string().trim().min(1).max(2_000)).min(1),
    observedAt: z.iso.date(),
    players: z.array(playerSchema).min(1),
    review: z.strictObject({
      approvedBy: z.string().trim().min(1),
      reviewedAt: z.iso.datetime({ offset: true }),
      status: z.literal("OWNER_APPROVED"),
    }),
    version: z.literal(1),
  })
  .superRefine((manifest, context) => {
    const slugs = new Set<string>();
    const hltvIds = new Set<string>();
    for (const player of manifest.players) {
      if (slugs.has(player.slug)) {
        context.addIssue({ code: "custom", message: `Duplicate slug ${player.slug}` });
      }
      slugs.add(player.slug);
      if (hltvIds.has(player.hltvIdentity.externalId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate HLTV ID ${player.hltvIdentity.externalId}`,
        });
      }
      hltvIds.add(player.hltvIdentity.externalId);
      const expected = `https://www.hltv.org/player/${player.hltvIdentity.externalId}/${player.hltvIdentity.externalSlug}`;
      if (player.hltvProfileUrl.replace(/\/$/, "") !== expected) {
        context.addIssue({
          code: "custom",
          message: `Profile URL does not match HLTV identity for ${player.slug}`,
          path: ["players"],
        });
      }
    }
  });

export type SpecialRetiredManifest = z.infer<typeof specialRetiredManifestSchema>;

export async function loadSpecialRetiredManifest(file: string): Promise<SpecialRetiredManifest> {
  return specialRetiredManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

export function summarizeSpecialRetiredManifest(manifest: SpecialRetiredManifest) {
  return {
    editionCode: manifest.editionCode,
    observedAt: manifest.observedAt,
    players: manifest.players.map((player) => player.slug),
    reviewStatus: manifest.review.status,
  };
}

export async function createAndAdmitSpecialRetiredPlayers(
  database: AppDatabase,
  poolService: CandidatePoolService,
  input: {
    actorAdminUserId: bigint;
    editionId: bigint;
    manifest: SpecialRetiredManifest;
  },
) {
  const identityReason = `Owner-reviewed Special retired identities observed ${input.manifest.observedAt}`;
  const admitted: Array<{ playerId: string; slug: string; status: "admitted" | "already_admitted" }> =
    [];

  for (const playerInput of input.manifest.players) {
    const [existing] = await database
      .select()
      .from(players)
      .where(eq(players.slug, playerInput.slug))
      .limit(1);

    const player = existing
      ? await updatePlayer(database, {
          actorAdminUserId: input.actorAdminUserId,
          countryCode: playerInput.countryCode,
          hltvProfileUrl: playerInput.hltvProfileUrl,
          nickname: playerInput.nickname,
          photoPath: playerInput.photoPath,
          playerId: existing.id,
          professionalStatus: "RETIRED",
          realName: playerInput.realName,
          reason: identityReason,
        })
      : await createPlayer(database, {
          actorAdminUserId: input.actorAdminUserId,
          countryCode: playerInput.countryCode,
          hltvProfileUrl: playerInput.hltvProfileUrl,
          nickname: playerInput.nickname,
          photoPath: playerInput.photoPath,
          professionalStatus: "RETIRED",
          realName: playerInput.realName,
          reason: identityReason,
          slug: playerInput.slug,
        });

    await upsertPlayerExternalIdentity(database, {
      actorAdminUserId: input.actorAdminUserId,
      externalId: playerInput.hltvIdentity.externalId,
      externalSlug: playerInput.hltvIdentity.externalSlug,
      playerId: player.id,
      provider: "HLTV",
      reason: identityReason,
      sourceUrl: playerInput.hltvIdentity.sourceUrl,
    });

    const [poolEntry] = await database
      .select({ id: poolPlayerEntries.id })
      .from(poolPlayerEntries)
      .where(
        and(
          eq(poolPlayerEntries.editionId, input.editionId),
          eq(poolPlayerEntries.playerId, player.id),
        ),
      )
      .limit(1);

    if (poolEntry) {
      admitted.push({
        playerId: player.id.toString(),
        slug: playerInput.slug,
        status: "already_admitted",
      });
      continue;
    }

    await poolService.admitSpecialPlayer({
      actorAdminUserId: input.actorAdminUserId,
      editionId: input.editionId,
      playerId: player.id,
      reason: playerInput.admissionReason,
    });
    admitted.push({
      playerId: player.id.toString(),
      slug: playerInput.slug,
      status: "admitted",
    });
  }

  if (admitted.length === 0) {
    throw new DomainError("SPECIAL_RETIRED_EMPTY", "Special retired manifest admitted no players");
  }
  return { admitted };
}
