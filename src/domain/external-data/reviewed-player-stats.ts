import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { playerExternalIdentities, players, playerStatSnapshots, poolPlayerEntries } from "../../db/schema/index.ts";
import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireNonBlank } from "../error.ts";
import type { CapturedHltvProfileStats } from "./providers/hltv.ts";
import { top20YearPeriod } from "./top20.ts";

export const REVIEWED_HLTV_PLAYER_STATS_VERSION = "hltv-reviewed-player-stats-json-v1";

const datedMetricSchema = z.strictObject({
  adr: z.number().nonnegative().max(200).nullable(),
  firepower: z.number().int().min(0).max(100).nullable(),
  maps: z.number().int().nonnegative(),
  rating: z.number().nonnegative().max(5),
});

const careerMetricSchema = z.strictObject({
  maps: z.number().int().nonnegative().nullable(),
  rating: z.number().nonnegative().max(5),
});

const top20PlacementSchema = z.strictObject({
  rank: z.number().int().min(1).max(20),
  year: z.number().int().min(2010).max(2099),
});

const reviewedPlayerStatsSchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provider: z.literal("HLTV"),
  records: z
    .array(
      z.strictObject({
        adr: z.number().nonnegative().max(200).nullable(),
        career: careerMetricSchema.nullable(),
        careerSourceUrl: z.url().nullable(),
        countryCode: z
          .string()
          .trim()
          .regex(/^[A-Z]{2}$/)
          .nullable(),
        externalId: z
          .string()
          .trim()
          .regex(/^[1-9]\d*$/),
        externalSlug: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .regex(/^[^/?#]+$/),
        firepower: z.number().int().min(0).max(100).nullable(),
        majorsWon: z.number().int().nonnegative().nullable(),
        mvpCount: z.number().int().nonnegative().nullable(),
        recent: datedMetricSchema.nullable(),
        recentSourceUrl: z.url(),
        top20Placements: z.array(top20PlacementSchema).max(30),
      }),
    )
    .min(1)
    .max(1_000),
  version: z.literal(1),
});

export type ReviewedHltvPlayerStats = z.infer<typeof reviewedPlayerStatsSchema>;

export function createReviewedHltvPlayerStatsTemplate(
  manifest: {
    teams: ReadonlyArray<{
      players: ReadonlyArray<{
        hltvIdentity: { externalId: string; externalSlug: string };
      }>;
    }>;
  },
  input: { capturedAt: string; periodEnd: string; periodStart: string },
): ReviewedHltvPlayerStats {
  return validateReviewedHltvPlayerStatsBundle(
    {
      capturedAt: input.capturedAt,
      periodEnd: input.periodEnd,
      periodStart: input.periodStart,
      provider: "HLTV",
      records: manifest.teams.flatMap((team) =>
        team.players.map((player) => ({
          adr: null,
          career: null,
          careerSourceUrl: null,
          countryCode: null,
          externalId: player.hltvIdentity.externalId,
          externalSlug: player.hltvIdentity.externalSlug,
          firepower: null,
          majorsWon: null,
          mvpCount: null,
          recent: null,
          recentSourceUrl: `https://www.hltv.org/stats/players/${player.hltvIdentity.externalId}/${player.hltvIdentity.externalSlug}?startDate=${input.periodStart}&endDate=${input.periodEnd}`,
          top20Placements: [],
        })),
      ),
      version: 1,
    },
    false,
  );
}

function requireOfficialStatsUrl(input: {
  externalId: string;
  externalSlug: string;
  mode: "CAREER" | "RECENT";
  periodEnd: string;
  periodStart: string;
  sourceUrl: string;
}): void {
  const url = new URL(input.sourceUrl);
  const expectedPath = `/stats/players/${input.externalId}/${input.externalSlug}`;
  const officialHost = url.hostname === "www.hltv.org" || url.hostname === "hltv.org";
  const baseValid =
    url.protocol === "https:" &&
    officialHost &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    url.hash === "" &&
    url.pathname.replace(/\/$/, "") === expectedPath;

  const recentQueryValid =
    url.searchParams.size === 2 &&
    url.searchParams.get("startDate") === input.periodStart &&
    url.searchParams.get("endDate") === input.periodEnd;
  const careerQueryValid = url.search === "";

  if (
    !baseValid ||
    (input.mode === "RECENT" && !recentQueryValid) ||
    (input.mode === "CAREER" && !careerQueryValid)
  ) {
    throw new DomainError(
      "REVIEWED_HLTV_STATS_SOURCE_INVALID",
      `${input.mode} stats for HLTV Player ${input.externalId} must reference its exact official stats URL`,
    );
  }
}

function validateReviewedHltvPlayerStatsBundle(
  input: unknown,
  requireAvailableMetric: boolean,
): ReviewedHltvPlayerStats {
  const bundle = reviewedPlayerStatsSchema.parse(input);
  if (bundle.periodEnd < bundle.periodStart) {
    throw new DomainError(
      "REVIEWED_HLTV_STATS_PERIOD_INVALID",
      "Reviewed HLTV stats period end cannot precede its start",
    );
  }

  const externalIds = new Set<string>();
  let availableMetrics = 0;
  for (const record of bundle.records) {
    if (externalIds.has(record.externalId)) {
      throw new DomainError(
        "REVIEWED_HLTV_STATS_IDENTITY_DUPLICATE",
        `Duplicate HLTV Player ID ${record.externalId}`,
      );
    }
    externalIds.add(record.externalId);

    requireOfficialStatsUrl({
      externalId: record.externalId,
      externalSlug: record.externalSlug,
      mode: "RECENT",
      periodEnd: bundle.periodEnd,
      periodStart: bundle.periodStart,
      sourceUrl: record.recentSourceUrl,
    });

    if ((record.career === null) !== (record.careerSourceUrl === null)) {
      throw new DomainError(
        "REVIEWED_HLTV_STATS_CAREER_INCOMPLETE",
        `HLTV Player ${record.externalId} requires both career data and its source, or neither`,
      );
    }
    if (record.careerSourceUrl) {
      requireOfficialStatsUrl({
        externalId: record.externalId,
        externalSlug: record.externalSlug,
        mode: "CAREER",
        periodEnd: bundle.periodEnd,
        periodStart: bundle.periodStart,
        sourceUrl: record.careerSourceUrl,
      });
    }
    const top20Years = new Set<number>();
    for (const placement of record.top20Placements) {
      if (top20Years.has(placement.year)) {
        throw new DomainError(
          "REVIEWED_HLTV_STATS_TOP20_DUPLICATE_YEAR",
          `HLTV Player ${record.externalId} has more than one Top 20 rank for ${placement.year}`,
        );
      }
      top20Years.add(placement.year);
    }
    if (record.recent) availableMetrics += 1;
    if (record.career) availableMetrics += 1;
    if (record.majorsWon !== null || record.mvpCount !== null) availableMetrics += 1;
    if (record.top20Placements.length > 0) availableMetrics += 1;
  }

  if (requireAvailableMetric && availableMetrics === 0) {
    throw new DomainError(
      "REVIEWED_HLTV_STATS_EMPTY",
      "Reviewed HLTV stats bundle contains no available metric",
    );
  }
  return bundle;
}

export function validateReviewedHltvPlayerStats(input: unknown): ReviewedHltvPlayerStats {
  return validateReviewedHltvPlayerStatsBundle(input, true);
}

export function mergeCapturedRecentStats(
  template: ReviewedHltvPlayerStats,
  captures: ReadonlyMap<string, CapturedHltvProfileStats>,
): ReviewedHltvPlayerStats {
  const knownIds = new Set(template.records.map((record) => record.externalId));
  for (const externalId of captures.keys()) {
    if (!knownIds.has(externalId)) {
      throw new DomainError(
        "REVIEWED_HLTV_STATS_IDENTITY_MISMATCH",
        `Captured HLTV Player ${externalId} is not in the reviewed template`,
      );
    }
  }

  return {
    ...template,
    records: template.records.map((record) => {
      const captured = captures.get(record.externalId);
      if (!captured) return record;
      return {
        ...record,
        adr: captured.adr,
        career:
          captured.careerRating === null
            ? record.career
            : { maps: null, rating: captured.careerRating },
        careerSourceUrl:
          captured.careerRating === null
            ? record.careerSourceUrl
            : `https://www.hltv.org/stats/players/${record.externalId}/${record.externalSlug}`,
        countryCode: captured.countryCode,
        firepower: captured.firepower,
        majorsWon: captured.majorsWon,
        mvpCount: captured.mvpCount,
        recent: {
          adr: captured.adr,
          firepower: captured.firepower,
          maps: captured.maps,
          rating: captured.rating,
        },
        top20Placements: captured.top20Placements,
      };
    }),
  };
}

export async function importReviewedHltvPlayerStats(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    bundle: ReviewedHltvPlayerStats;
    checksum: string;
    reason: string;
  },
) {
  const reason = requireNonBlank(input.reason, "reviewed stats import reason");
  const checksum = requireNonBlank(input.checksum, "reviewed stats checksum");
  const capturedAt = new Date(input.bundle.capturedAt);

  return database.transaction(async (transaction) => {
    const identityRows = await transaction
      .select({
        countryCode: players.countryCode,
        externalId: playerExternalIdentities.externalId,
        externalSlug: playerExternalIdentities.externalSlug,
        playerId: playerExternalIdentities.playerId,
      })
      .from(playerExternalIdentities)
      .innerJoin(players, eq(players.id, playerExternalIdentities.playerId))
      .innerJoin(poolPlayerEntries, eq(poolPlayerEntries.playerId, players.id))
      .where(
        and(
          eq(playerExternalIdentities.provider, "HLTV"),
          ne(players.professionalStatus, "RETIRED"),
        ),
      );
    const identities = [...new Map(identityRows.map((identity) => [identity.externalId, identity])).values()];
    const identityByExternalId = new Map(
      identities.map((identity) => [identity.externalId, identity]),
    );
    const suppliedIds = new Set(input.bundle.records.map((record) => record.externalId));
    const missingIds = identities
      .filter((identity) => !suppliedIds.has(identity.externalId))
      .map((identity) => identity.externalId)
      .sort();
    const unknownIds = input.bundle.records
      .filter((record) => !identityByExternalId.has(record.externalId))
      .map((record) => record.externalId)
      .sort();
    if (missingIds.length > 0 || unknownIds.length > 0) {
      throw new DomainError(
        "REVIEWED_HLTV_STATS_COVERAGE_MISMATCH",
        "Reviewed HLTV stats must cover every non-retired pairing-pool HLTV Player identity exactly once",
        { missingIds, unknownIds },
      );
    }

    for (const record of input.bundle.records) {
      const identity = identityByExternalId.get(record.externalId);
      if (!identity || (identity.externalSlug ?? identity.externalId) !== record.externalSlug) {
        throw new DomainError(
          "REVIEWED_HLTV_STATS_IDENTITY_MISMATCH",
          `Reviewed HLTV Player ${record.externalId} does not match its configured slug`,
        );
      }
    }

    const [existing] = await transaction
      .select({ id: playerStatSnapshots.id })
      .from(playerStatSnapshots)
      .where(
        and(
          eq(playerStatSnapshots.provider, "HLTV"),
          eq(playerStatSnapshots.capturedAt, capturedAt),
        ),
      )
      .limit(1);
    if (existing) {
      throw new DomainError(
        "REVIEWED_HLTV_STATS_ALREADY_IMPORTED",
        "HLTV stats already exist for this capture timestamp",
      );
    }

    const values: Array<typeof playerStatSnapshots.$inferInsert> = [];
    const missingRecentExternalIds: string[] = [];
    const countryUpdates: Array<{ countryCode: string; externalId: string }> = [];
    let careerSnapshots = 0;
    let firepowerSnapshots = 0;
    let adrSnapshots = 0;
    let majorsWonSnapshots = 0;
    let mvpCountSnapshots = 0;
    let recentSnapshots = 0;
    let top20RankSnapshots = 0;
    for (const record of input.bundle.records) {
      const identity = identityByExternalId.get(record.externalId)!;
      const profileUrl = `https://www.hltv.org/player/${record.externalId}/${record.externalSlug}`;
      if (record.recent) {
        values.push({
          capturedAt,
          maps: record.recent.maps,
          metric: "rating_3_0",
          periodEnd: input.bundle.periodEnd,
          periodStart: input.bundle.periodStart,
          periodType: "LAST_3_MONTHS",
          playerId: identity.playerId,
          provider: "HLTV",
          sourceUrl: record.recentSourceUrl,
          value: String(record.recent.rating),
        });
        recentSnapshots += 1;
        if (record.recent.firepower !== null) {
          values.push({
            capturedAt,
            maps: record.recent.maps,
            metric: "firepower",
            periodEnd: input.bundle.periodEnd,
            periodStart: input.bundle.periodStart,
            periodType: "LAST_3_MONTHS",
            playerId: identity.playerId,
            provider: "HLTV",
            sourceUrl: record.recentSourceUrl,
            value: String(record.recent.firepower),
          });
          firepowerSnapshots += 1;
        }
        if (record.recent.adr !== null) {
          values.push({
            capturedAt,
            maps: record.recent.maps,
            metric: "adr",
            periodEnd: input.bundle.periodEnd,
            periodStart: input.bundle.periodStart,
            periodType: "LAST_3_MONTHS",
            playerId: identity.playerId,
            provider: "HLTV",
            sourceUrl: record.recentSourceUrl,
            value: String(record.recent.adr),
          });
          adrSnapshots += 1;
        }
      } else {
        missingRecentExternalIds.push(record.externalId);
      }
      if (record.career && record.careerSourceUrl) {
        values.push({
          capturedAt,
          maps: record.career.maps,
          metric: "career_rating",
          periodType: "CAREER",
          playerId: identity.playerId,
          provider: "HLTV",
          sourceUrl: record.careerSourceUrl,
          value: String(record.career.rating),
        });
        careerSnapshots += 1;
      }
      if (record.majorsWon !== null) {
        values.push({
          capturedAt,
          maps: null,
          metric: "majors_won",
          periodType: "CAREER",
          playerId: identity.playerId,
          provider: "HLTV",
          sourceUrl: `https://www.hltv.org/player/${record.externalId}/${record.externalSlug}`,
          value: String(record.majorsWon),
        });
        majorsWonSnapshots += 1;
      }
      if (record.mvpCount !== null) {
        values.push({
          capturedAt,
          maps: null,
          metric: "mvp_count",
          periodType: "CAREER",
          playerId: identity.playerId,
          provider: "HLTV",
          sourceUrl: `https://www.hltv.org/player/${record.externalId}/${record.externalSlug}`,
          value: String(record.mvpCount),
        });
        mvpCountSnapshots += 1;
      }
      for (const placement of record.top20Placements) {
        const period = top20YearPeriod(placement.year);
        values.push({
          capturedAt,
          maps: null,
          metric: "top20_rank",
          periodEnd: period.periodEnd,
          periodStart: period.periodStart,
          periodType: "CAREER",
          playerId: identity.playerId,
          provider: "HLTV",
          sourceUrl: profileUrl,
          value: String(placement.rank),
        });
        top20RankSnapshots += 1;
      }
      if (record.countryCode && record.countryCode !== identity.countryCode) {
        await transaction
          .update(players)
          .set({ countryCode: record.countryCode, updatedAt: capturedAt })
          .where(eq(players.id, identity.playerId));
        countryUpdates.push({
          countryCode: record.countryCode,
          externalId: record.externalId,
        });
      }
    }
    if (values.length === 0) {
      throw new DomainError(
        "REVIEWED_HLTV_STATS_EMPTY",
        "Reviewed HLTV stats bundle contains no available metric",
      );
    }
    await transaction.insert(playerStatSnapshots).values(values);

    const result = {
      adrSnapshots,
      capturedAt: input.bundle.capturedAt,
      careerSnapshots,
      checksum,
      countryUpdates: countryUpdates.length,
      firepowerSnapshots,
      majorsWonSnapshots,
      missingRecentExternalIds: missingRecentExternalIds.sort(),
      mvpCountSnapshots,
      periodEnd: input.bundle.periodEnd,
      periodStart: input.bundle.periodStart,
      playersReviewed: input.bundle.records.length,
      recentSnapshots,
      top20RankSnapshots,
      updatedCountryCodes: countryUpdates,
      version: REVIEWED_HLTV_PLAYER_STATS_VERSION,
    };
    await writeAdminAudit(transaction, {
      action: "IMPORT_REVIEWED_HLTV_PLAYER_STATS",
      actorAdminUserId: input.actorAdminUserId,
      after: result,
      reason,
      targetId: checksum,
      targetType: "PLAYER_STATS_BUNDLE",
    });
    return result;
  });
}
