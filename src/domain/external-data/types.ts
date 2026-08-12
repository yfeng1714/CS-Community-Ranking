import { z } from "zod";

const normalizedTeam = z.strictObject({
  externalId: z.string().trim().min(1).max(500).nullable(),
  externalSlug: z.string().trim().min(1).max(500).nullable(),
  name: z.string().trim().min(1).max(300),
  points: z.number().int().nonnegative().nullable(),
  rank: z.number().int().positive(),
  roster: z.array(z.string().trim().min(1).max(100)).max(10),
});

export const normalizedRankingSnapshotSchema = z.strictObject({
  publishedAt: z.iso.datetime({ offset: true }),
  sourceUrl: z.url(),
  teams: z.array(normalizedTeam).min(1),
  version: z.literal(1),
});

export type NormalizedRankingSnapshot = z.infer<typeof normalizedRankingSnapshotSchema>;
export type NormalizedTeamRanking = NormalizedRankingSnapshot["teams"][number];

export const normalizedPlayerStatsSchema = z.strictObject({
  career: z.strictObject({
    maps: z.number().int().nonnegative().nullable(),
    rating: z.number().nonnegative(),
  }),
  externalId: z.string().trim().min(1).max(500),
  recent: z.strictObject({
    maps: z.number().int().nonnegative(),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rating: z.number().nonnegative(),
  }),
  sourceUrl: z.url(),
  version: z.literal(1),
});

export type NormalizedPlayerStats = z.infer<typeof normalizedPlayerStatsSchema>;
