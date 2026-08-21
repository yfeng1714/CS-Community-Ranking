import { z } from "zod";

import { DomainError } from "../error.ts";

export const EVENT_MVP_BUNDLE_VERSION = "hltv-event-mvp-top15-json-v1";
export const CURRENT_EVENT_MVP_SLUG = "ewc-2026";
export const CURRENT_EVENT_MVP_PATH = "/current-event";
export const EVENT_MVP_CANDIDATE_LIMIT = 15;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const recordSchema = z.strictObject({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  eventRating: z.string().regex(/^\d+\.\d{2}$/),
  externalId: z.string().regex(/^[1-9]\d*$/),
  externalSlug: slug,
  maps: z.number().int().nonnegative(),
  nickname: z.string().trim().min(1).max(100),
  slug,
  sourceRank: z.number().int().min(1).max(EVENT_MVP_CANDIDATE_LIMIT),
  team: z.string().trim().min(1).max(100),
});

export const eventMvpBundleSchema = z.strictObject({
  contest: z.strictObject({
    capturedAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.date(),
    eventUrl: z.url({ protocol: /^https$/ }),
    hltvEventId: z.string().regex(/^[1-9]\d*$/),
    name: z.string().trim().min(1).max(120),
    navLabel: z.string().trim().min(1).max(40),
    slug,
    sourceUrl: z.url({ protocol: /^https$/ }),
    startsAt: z.iso.date(),
  }),
  notes: z.array(z.string().trim().min(1).max(2_000)).min(1),
  records: z.array(recordSchema).length(EVENT_MVP_CANDIDATE_LIMIT),
  version: z.literal(1),
});

export type EventMvpBundle = z.infer<typeof eventMvpBundleSchema>;
export type EventMvpRecord = EventMvpBundle["records"][number];

export function validateEventMvpBundle(input: unknown): EventMvpBundle {
  const bundle = eventMvpBundleSchema.parse(input);
  if (bundle.contest.endsAt < bundle.contest.startsAt) {
    throw new DomainError("EVENT_MVP_DATE_ORDER", "Event MVP contest ends before it starts");
  }
  const ranks = new Set<number>();
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const record of bundle.records) {
    if (ranks.has(record.sourceRank) || slugs.has(record.slug) || ids.has(record.externalId)) {
      throw new DomainError(
        "EVENT_MVP_COVERAGE_MISMATCH",
        "Event MVP bundle has duplicate rank, slug, or HLTV id",
      );
    }
    ranks.add(record.sourceRank);
    slugs.add(record.slug);
    ids.add(record.externalId);
  }
  if (ranks.size !== EVENT_MVP_CANDIDATE_LIMIT) {
    throw new DomainError(
      "EVENT_MVP_COVERAGE_MISMATCH",
      "Event MVP bundle must cover ranks 1–15 exactly once",
    );
  }
  for (let rank = 1; rank <= EVENT_MVP_CANDIDATE_LIMIT; rank += 1) {
    if (!ranks.has(rank)) {
      throw new DomainError(
        "EVENT_MVP_COVERAGE_MISMATCH",
        "Event MVP bundle must cover ranks 1–15 exactly once",
      );
    }
  }
  return bundle;
}
