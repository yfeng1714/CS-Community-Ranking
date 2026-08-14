import { DomainError } from "../error.ts";
import { normalizedRankingSnapshotSchema, type NormalizedRankingSnapshot } from "./types.ts";

export const REVIEWED_HLTV_RANKING_VERSION = "hltv-reviewed-top12-json-v1";

export function validateReviewedHltvRanking(input: unknown): NormalizedRankingSnapshot {
  const snapshot = normalizedRankingSnapshotSchema.parse(input);
  const url = new URL(snapshot.sourceUrl);
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "www.hltv.org" && url.hostname !== "hltv.org") ||
    !/^\/ranking\/teams\/\d{4}\/[a-z]+\/\d+(?:\/|$)/.test(url.pathname)
  ) {
    throw new DomainError(
      "REVIEWED_HLTV_SOURCE_INVALID",
      "Reviewed HLTV ranking must reference an official dated ranking URL",
    );
  }

  const top12 = snapshot.teams.filter((team) => team.rank <= 12);
  const ranks = top12.map((team) => team.rank).sort((left, right) => left - right);
  if (ranks.length !== 12 || ranks.some((rank, index) => rank !== index + 1)) {
    throw new DomainError(
      "REVIEWED_HLTV_TOP12_INCOMPLETE",
      "Reviewed HLTV input must contain each rank from 1 through 12 exactly once",
    );
  }

  const externalIds = new Set<string>();
  for (const team of top12) {
    if (!team.externalId || !team.externalSlug || team.roster.length !== 5) {
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
