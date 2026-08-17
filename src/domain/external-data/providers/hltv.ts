import { DomainError } from "../../error.ts";
import {
  normalizedPlayerStatsSchema,
  normalizedRankingSnapshotSchema,
  type NormalizedPlayerStats,
  type NormalizedRankingSnapshot,
} from "../types.ts";

export const HLTV_RANKING_PARSER_VERSION = "hltv-ranking-html-v1";
export const HLTV_PLAYER_STATS_PARSER_VERSION = "hltv-player-stats-html-v1";
export const HLTV_PLAYER_PROFILE_STATS_PARSER_VERSION = "hltv-player-profile-stats-html-v3";

export interface CapturedHltvProfileStats {
  adr: number | null;
  careerRating: number | null;
  countryCode: string | null;
  firepower: number | null;
  majorsWon: number | null;
  maps: number;
  mvpCount: number | null;
  rating: number;
  top20Placements: Array<{ rank: number; year: number }>;
}

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

export function isHltvAccessDeniedHtml(body: string): boolean {
  const head = body.slice(0, 20_000);
  return (
    /just a moment/i.test(head) ||
    /performing security verification/i.test(head) ||
    /checking your browser before accessing/i.test(head) ||
    /sorry, you have been blocked/i.test(head) ||
    /enable javascript and cookies to continue/i.test(head)
  );
}

function nonnegativeInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function highlightedCount(body: string, description: string): number | null {
  const escaped = description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<div[^>]*class=["'][^"']*\\bhighlighted-stat\\b[^"']*["'][^>]*>\\s*<div[^>]*class=["']stat["'][^>]*>\\s*([0-9][0-9,]*)\\s*</div>\\s*<div[^>]*class=["']description["'][^>]*>\\s*${escaped}\\s*<`,
    "i",
  ).exec(body);
  return nonnegativeInt(match?.[1]);
}

function majorWinnerCount(body: string): number | null {
  const match =
    /<div[^>]*class=["'][^"']*\bmajorWinner\b[^"']*["'][^>]*>\s*<b>\s*([0-9][0-9,]*)\s*<\/b>\s*x\s*Major winner/i.exec(
      body,
    );
  return nonnegativeInt(match?.[1]);
}

function mvpBadgeCount(body: string): number | null {
  const match = /<div[^>]*class=["'][^"']*\bmvp-count\b[^"']*["'][^>]*>\s*([0-9][0-9,]*)/i.exec(
    body,
  );
  return nonnegativeInt(match?.[1]);
}

function parseFirepower(body: string): number | null {
  const match =
    /<b>\s*Firepower\s*<\/b>[\s\S]{0,240}?<span[^>]*class=["'][^"']*\bstatsVal\b[^"']*["'][^>]*>\s*<p>\s*<b>\s*([0-9]{1,3})\s*<\/b>/i.exec(
      body,
    );
  const value = match?.[1] ? Number(match[1]) : NaN;
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

function parseAdr(body: string): number | null {
  const container =
    /<div[^>]*class=["'][^"']*\bplayerpage-container\b[^"']*["'][^>]*>([\s\S]{0,8000})/i.exec(
      body,
    )?.[1] ?? "";
  const match = /<b>\s*ADR\s*<\/b>[\s\S]{0,160}?<p>\s*([0-9]{1,3}(?:\.[0-9]+)?)/i.exec(container);
  const value = match?.[1] ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value >= 0 && value <= 200 ? value : null;
}

function parseCountryCode(body: string): string | null {
  const flag = /<div[^>]*class=["'][^"']*\bplayer-summary-stat-box-left-flag\b[^"']*["'][^>]*>\s*<img\b([^>]+)>/i.exec(
    body,
  )?.[1];
  const code = flag
    ? /\/flags\/\d+x\d+\/([A-Za-z]{2})\.gif/i.exec(flag)?.[1]
    : null;
  return code ? code.toUpperCase() : null;
}

function parseTop20Placements(body: string): Array<{ rank: number; year: number }> {
  const section =
    /<h2[^>]*>\s*Top 20 overview for[\s\S]*?<\/h2>\s*<table\b[\s\S]*?<\/table>/i.exec(body)?.[0];
  if (!section) return [];

  const placements = new Map<number, number>();
  for (const row of section.matchAll(
    /<tr[^>]*class=["'][^"']*\btrophy-row\b[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi,
  )) {
    const block = row[1] ?? "";
    const rank = Number(/#(\d{1,2})\s+best player in/i.exec(block)?.[1]);
    const year = Number(
      /class=["'][^"']*\btrophy-rating-number\b[^"']*["'][^>]*>\s*(\d{4})/i.exec(block)?.[1],
    );
    if (
      !Number.isInteger(rank) ||
      rank < 1 ||
      rank > 20 ||
      !Number.isInteger(year) ||
      year < 2010 ||
      year > 2099
    ) {
      continue;
    }
    placements.set(year, rank);
  }
  return [...placements.entries()]
    .map(([year, rank]) => ({ rank, year }))
    .sort((left, right) => right.year - left.year);
}

export function parseHltvPlayerProfileStatsHtml(body: string): CapturedHltvProfileStats {
  if (isHltvAccessDeniedHtml(body)) {
    throw new DomainError(
      "HLTV_ACCESS_DENIED",
      "HLTV HTML is a Cloudflare challenge or block page",
    );
  }

  const decoded = decodeHtml(body)
    .replaceAll("&bull;", "•")
    .replaceAll("&#8226;", "•")
    .replaceAll("&#x2022;", "•");
  const mapsMatch = /\(\s*Past 3 months\s*[•·*\-–—]\s*([0-9]{1,5})\s*maps\s*\)/i.exec(decoded);
  const ratingMatch =
    /<div[^>]*class=["'][^"']*\bplayer-stat\b[^"']*["'][^>]*>\s*<b>\s*Rating 3\.0\s*<\/b>\s*<span[^>]*class=["'][^"']*\bstatsVal\b[^"']*["'][^>]*>\s*<p>\s*([0-9]+(?:\.[0-9]+)?)/i.exec(
      decoded,
    );
  const maps = mapsMatch?.[1] ? Number(mapsMatch[1]) : NaN;
  const rating = ratingMatch?.[1] ? Number(ratingMatch[1]) : NaN;
  if (!Number.isInteger(maps) || maps < 0 || !Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new DomainError(
      "HLTV_PLAYER_PROFILE_STATS_PARSE_FAILED",
      "HLTV player profile HTML did not expose Past 3 months maps and Rating 3.0",
    );
  }
  return {
    adr: parseAdr(decoded),
    careerRating: null,
    countryCode: parseCountryCode(decoded),
    firepower: parseFirepower(decoded),
    majorsWon: highlightedCount(decoded, "Majors won") ?? majorWinnerCount(decoded),
    maps,
    mvpCount: highlightedCount(decoded, "Total MVPs") ?? mvpBadgeCount(decoded),
    rating,
    top20Placements: parseTop20Placements(decoded),
  };
}

export function parseHltvPlayerProfileRecentStatsHtml(body: string): {
  maps: number;
  rating: number;
} {
  const parsed = parseHltvPlayerProfileStatsHtml(body);
  return { maps: parsed.maps, rating: parsed.rating };
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
