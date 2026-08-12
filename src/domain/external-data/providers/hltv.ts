import { DomainError } from "../../error.ts";
import {
  normalizedPlayerStatsSchema,
  normalizedRankingSnapshotSchema,
  type NormalizedPlayerStats,
  type NormalizedRankingSnapshot,
} from "../types.ts";

export const HLTV_RANKING_PARSER_VERSION = "hltv-ranking-html-v1";
export const HLTV_PLAYER_STATS_PARSER_VERSION = "hltv-player-stats-html-v1";

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value: string): string {
  return decodeHtml(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function assertHltvUrl(value: string): void {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "www.hltv.org" && url.hostname !== "hltv.org")
  ) {
    throw new DomainError("HLTV_SOURCE_INVALID", "HLTV source must use an official hltv.org URL");
  }
}

export function parseHltvTeamRankingHtml(
  body: string,
  sourceUrl: string,
  publishedAt: Date,
): NormalizedRankingSnapshot {
  assertHltvUrl(sourceUrl);
  const blockPattern =
    /<div[^>]+class=["'][^"']*ranked-team[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*ranked-team|$)/gi;
  const teams = [...body.matchAll(blockPattern)].map((match) => {
    const block = match[1] ?? "";
    const link = /href=["']\/team\/(\d+)\/([^"'/?#]+)["']/i.exec(block);
    const rank = /class=["'][^"']*position[^"']*["'][^>]*>\s*#?(\d+)/i.exec(block);
    const name = /class=["'][^"']*(?:name|teamName)[^"']*["'][^>]*>([\s\S]*?)<\//i.exec(block);
    const points = /\((\d+)\s+points?\)/i.exec(stripTags(block));
    const roster = [
      ...block.matchAll(/class=["'][^"']*(?:player|player-holder)[^"']*["'][^>]*>([\s\S]*?)<\//gi),
    ]
      .map((player) => stripTags(player[1] ?? ""))
      .filter(Boolean);
    return {
      externalId: link?.[1] ?? null,
      externalSlug: link?.[2] ?? null,
      name: stripTags(name?.[1] ?? ""),
      points: points ? Number(points[1]) : null,
      rank: Number(rank?.[1]),
      roster,
    };
  });
  const result = normalizedRankingSnapshotSchema.safeParse({
    publishedAt: publishedAt.toISOString(),
    sourceUrl,
    teams,
    version: 1,
  });
  if (!result.success || teams.some((team) => team.externalId === null)) {
    throw new DomainError(
      "HLTV_RANKING_PARSE_FAILED",
      "HLTV ranking HTML did not match the expected format",
      {
        issues: result.success
          ? ["team external ID missing"]
          : result.error.issues.map((issue) => issue.message),
      },
    );
  }
  return result.data;
}

function labeledNumber(body: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<[^>]+data-stat=["']${escaped}["'][^>]*>\\s*([0-9]+(?:\\.[0-9]+)?)`, "i"),
    new RegExp(
      `${escaped}[\\s\\S]{0,160}?<[^>]+class=["'][^"']*(?:value|statsVal)[^"']*["'][^>]*>\\s*([0-9]+(?:\\.[0-9]+)?)`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(body);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

export function parseHltvPlayerStatsHtml(input: {
  body: string;
  externalId: string;
  periodEnd: string;
  periodStart: string;
  sourceUrl: string;
}): NormalizedPlayerStats {
  assertHltvUrl(input.sourceUrl);
  const recentRating = labeledNumber(input.body, "rating_3_0");
  const recentMaps = labeledNumber(input.body, "recent_maps");
  const careerRating = labeledNumber(input.body, "career_rating");
  const careerMaps = labeledNumber(input.body, "career_maps");
  const result = normalizedPlayerStatsSchema.safeParse({
    career: { maps: careerMaps, rating: careerRating },
    externalId: input.externalId,
    recent: {
      maps: recentMaps,
      periodEnd: input.periodEnd,
      periodStart: input.periodStart,
      rating: recentRating,
    },
    sourceUrl: input.sourceUrl,
    version: 1,
  });
  if (!result.success) {
    throw new DomainError(
      "HLTV_PLAYER_STATS_PARSE_FAILED",
      "HLTV player stats HTML did not match the expected format",
      {
        issues: result.error.issues.map((issue) => issue.message),
      },
    );
  }
  return result.data;
}
