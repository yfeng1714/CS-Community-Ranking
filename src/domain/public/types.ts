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
  teamLogoUrl: string | null;
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
  adr: number | null;
  careerRating: number | null;
  country: string | null;
  firepower: number | null;
  freshness: DataFreshness;
  hltvProfileUrl: string | null;
  majorsWon: number | null;
  mvpCount: number | null;
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
  teamLogoUrl: string | null;
  teamShortName: string | null;
  top20Peak: { rank: number; years: number[] } | null;
}

export interface PublicPlayerStats {
  adr: number | null;
  careerRating: number | null;
  firepower: number | null;
  freshness: DataFreshness;
  majorsWon: number | null;
  mvpCount: number | null;
  recentMaps: number | null;
  recentRating: number | null;
  statsCapturedAt: string | null;
  top20Peak: { rank: number; years: number[] } | null;
}
