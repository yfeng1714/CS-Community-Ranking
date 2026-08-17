import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { playerStatSnapshots, players } from "../../db/schema/index.ts";
import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue } from "../error.ts";

export const REVIEWED_CAREER_RATING_VERSION = "hltv-reviewed-career-rating-json-v1";

const recordSchema = z.strictObject({
  rating: z.number().nonnegative().max(5),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sourceUrl: z.url({ protocol: /^https$/ }),
});

const bundleSchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  notes: z.array(z.string().trim().min(1).max(2_000)).min(1),
  provider: z.literal("HLTV"),
  records: z.array(recordSchema).min(1),
  version: z.literal(1),
});

export type ReviewedCareerRatingBundle = z.infer<typeof bundleSchema>;

export function validateReviewedCareerRatingBundle(input: unknown): ReviewedCareerRatingBundle {
  const bundle = bundleSchema.parse(input);
  const slugs = new Set<string>();
  for (const record of bundle.records) {
    if (slugs.has(record.slug)) {
      throw new DomainError(
        "REVIEWED_CAREER_RATING_SLUG_DUPLICATE",
        `Duplicate career Rating slug ${record.slug}`,
      );
    }
    slugs.add(record.slug);
    const url = new URL(record.sourceUrl);
    if (url.hostname !== "www.hltv.org" && url.hostname !== "hltv.org") {
      throw new DomainError(
        "REVIEWED_CAREER_RATING_SOURCE_INVALID",
        `Career Rating for ${record.slug} must reference an official HLTV URL`,
      );
    }
  }
  return bundle;
}

export async function importReviewedCareerRatings(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    bundle: ReviewedCareerRatingBundle;
    checksum: string;
    reason: string;
  },
) {
  const capturedAt = new Date(input.bundle.capturedAt);
  return database.transaction(async (transaction) => {
    const written: Array<{ playerId: string; rating: number; slug: string }> = [];
    for (const record of input.bundle.records) {
      const [player] = await transaction
        .select({ id: players.id, slug: players.slug })
        .from(players)
        .where(eq(players.slug, record.slug))
        .limit(1);
      const current = requireDomainValue(
        player,
        "PLAYER_NOT_FOUND",
        `Player ${record.slug} not found`,
      );
      const [existing] = await transaction
        .select({ id: playerStatSnapshots.id })
        .from(playerStatSnapshots)
        .where(
          and(
            eq(playerStatSnapshots.playerId, current.id),
            eq(playerStatSnapshots.provider, "HLTV"),
            eq(playerStatSnapshots.metric, "career_rating"),
            eq(playerStatSnapshots.capturedAt, capturedAt),
          ),
        )
        .limit(1);
      if (existing) {
        throw new DomainError(
          "REVIEWED_CAREER_RATING_ALREADY_IMPORTED",
          `Career Rating for ${record.slug} already imported at ${input.bundle.capturedAt}`,
        );
      }
      await transaction.insert(playerStatSnapshots).values({
        capturedAt,
        maps: null,
        metric: "career_rating",
        periodType: "CAREER",
        playerId: current.id,
        provider: "HLTV",
        sourceUrl: record.sourceUrl,
        value: String(record.rating),
      });
      written.push({
        playerId: current.id.toString(),
        rating: record.rating,
        slug: record.slug,
      });
    }
    await writeAdminAudit(transaction, {
      action: "IMPORT_REVIEWED_CAREER_RATING",
      actorAdminUserId: input.actorAdminUserId,
      after: { checksum: input.checksum, records: written },
      reason: input.reason,
      targetId: input.checksum,
      targetType: "PLAYER_STAT_SNAPSHOT",
    });
    return { capturedAt: input.bundle.capturedAt, records: written };
  });
}
