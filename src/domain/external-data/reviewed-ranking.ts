import { DomainError } from "../error.ts";
import { normalizedRankingSnapshotSchema, type NormalizedRankingSnapshot } from "./types.ts";

export const REVIEWED_HLTV_RANKING_VERSION = "hltv-reviewed-top12-json-v1";
export const REVIEWED_HLTV_TOP20_RANKING_VERSION = "hltv-reviewed-top20-json-v1";

export type ReviewedHltvRankingCoverage = 12 | 20;

const monthNumbers: Record<string, number> = {
  april: 4,
  august: 8,
  december: 12,
  february: 2,
  january: 1,
  july: 7,
  june: 6,
  march: 3,
  may: 5,
  november: 11,
  october: 10,
  september: 9,
};

export function reviewedHltvRankingCoverage(
  snapshot: NormalizedRankingSnapshot,
): ReviewedHltvRankingCoverage {
  const highestRank = Math.max(...snapshot.teams.map((team) => team.rank));
  if (highestRank !== 12 && highestRank !== 20) {
    throw new DomainError(
      "REVIEWED_HLTV_COVERAGE_UNSUPPORTED",
      "Reviewed HLTV input must cover either ranks 1–12 or ranks 1–20",
    );
  }
  return highestRank;
}

export function reviewedHltvRankingParserVersion(snapshot: NormalizedRankingSnapshot): string {
  return reviewedHltvRankingCoverage(snapshot) === 20
    ? REVIEWED_HLTV_TOP20_RANKING_VERSION
    : REVIEWED_HLTV_RANKING_VERSION;
}

export function validateReviewedHltvRanking(input: unknown): NormalizedRankingSnapshot {
  const snapshot = normalizedRankingSnapshotSchema.parse(input);
  const url = new URL(snapshot.sourceUrl);
  const datedPath = /^\/ranking\/teams\/(\d{4})\/([a-z]+)\/(\d+)\/?$/.exec(url.pathname);
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "www.hltv.org" && url.hostname !== "hltv.org") ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !datedPath
  ) {
    throw new DomainError(
      "REVIEWED_HLTV_SOURCE_INVALID",
      "Reviewed HLTV ranking must reference an official dated ranking URL",
    );
  }

  const publishedAt = new Date(snapshot.publishedAt);
  const publishedDateMatchesPath =
    Number(datedPath[1]) === publishedAt.getUTCFullYear() &&
    monthNumbers[datedPath[2]!] === publishedAt.getUTCMonth() + 1 &&
    Number(datedPath[3]) === publishedAt.getUTCDate();
  if (!publishedDateMatchesPath) {
    throw new DomainError(
      "REVIEWED_HLTV_DATE_MISMATCH",
      "Reviewed HLTV publication time must match its official dated ranking URL",
    );
  }

  const coverage = reviewedHltvRankingCoverage(snapshot);
  const ranks = snapshot.teams.map((team) => team.rank).sort((left, right) => left - right);
  if (ranks.length !== coverage || ranks.some((rank, index) => rank !== index + 1)) {
    throw new DomainError(
      coverage === 20 ? "REVIEWED_HLTV_TOP20_INCOMPLETE" : "REVIEWED_HLTV_TOP12_INCOMPLETE",
      `Reviewed HLTV input must contain each rank from 1 through ${coverage} exactly once`,
    );
  }

  const externalIds = new Set<string>();
  for (const team of snapshot.teams) {
    const uniqueRoster = new Set(
      team.roster.map((nickname) => nickname.normalize("NFKC").trim().toLocaleLowerCase("en")),
    );
    if (
      !team.externalId ||
      !team.externalSlug ||
      team.roster.length !== 5 ||
      uniqueRoster.size !== 5
    ) {
      throw new DomainError(
        "REVIEWED_HLTV_TEAM_INCOMPLETE",
        `HLTV #${team.rank} requires identity and exactly five starters`,
      );
    }
    if (externalIds.has(team.externalId)) {
      throw new DomainError(
        "REVIEWED_HLTV_IDENTITY_DUPLICATE",
        `Duplicate HLTV Team ID ${team.externalId}`,
      );
    }
    externalIds.add(team.externalId);
  }
  return snapshot;
}
