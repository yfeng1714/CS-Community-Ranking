import type { DataFreshness } from "./presentation.ts";

export interface PublicEdition {
  code: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT" | "FROZEN";
}

export interface PublicRankingPlayer {
  country: string | null;
  decisions: number;
  losses: number;
  nickname: string;
  photoUrl: string | null;
  rank: number;
  score: number;
  skips: number;
  slug: string;
  team: string | null;
  teamShortName: string | null;
  updatedAt: string;
  winRate: number | null;
  wins: number;
}

export interface PublicRanking {
  edition: PublicEdition | null;
  players: PublicRankingPlayer[];
  updatedAt: string | null;
}

export interface PublicPlayerProfile {
  careerRating: number | null;
  country: string | null;
  freshness: DataFreshness;
  nickname: string;
  photoUrl: string | null;
  professionalStatus: "ACTIVE" | "INACTIVE" | "RETIRED";
  ranking: PublicRankingPlayer | null;
  realName: string | null;
  recentMaps: number | null;
  recentRating: number | null;
  slug: string;
  statsCapturedAt: string | null;
  team: string | null;
  teamShortName: string | null;
}

export interface PublicPlayerStats {
  careerRating: number | null;
  freshness: DataFreshness;
  recentMaps: number | null;
  recentRating: number | null;
  statsCapturedAt: string | null;
}
