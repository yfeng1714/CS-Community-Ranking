import { pgEnum } from "drizzle-orm/pg-core";

export const professionalStatusEnum = pgEnum("professional_status", [
  "ACTIVE",
  "INACTIVE",
  "RETIRED",
]);

export const rosterStatusEnum = pgEnum("roster_status", ["STARTER", "BENCH", "STAND_IN"]);

export const editionStatusEnum = pgEnum("edition_status", [
  "DRAFT",
  "ACTIVE",
  "FROZEN",
  "ARCHIVED",
]);

export const whitelistReasonEnum = pgEnum("whitelist_reason", [
  "MAJOR",
  "HLTV_HIGHLIGHT",
  "MANUAL",
  "NONE",
]);

export const teamAdmissionTypeEnum = pgEnum("team_admission_type", [
  "CORE",
  "REVIEW_AUTO",
  "REVIEW_MANUAL",
]);

export const playerAdmissionTypeEnum = pgEnum("player_admission_type", [
  "CORE",
  "REVIEW_AUTO",
  "REVIEW_MANUAL",
  "SPECIAL",
]);

export const visitorRiskStateEnum = pgEnum("visitor_risk_state", ["NORMAL", "WATCH", "SUSPICIOUS"]);

export const ballotStatusEnum = pgEnum("ballot_status", ["OPEN", "RESOLVED", "EXPIRED"]);

export const ballotResolutionEnum = pgEnum("ballot_resolution", ["LEFT", "RIGHT", "SKIP"]);

export const rankingEligibilityEnum = pgEnum("ranking_eligibility", [
  "ELIGIBLE",
  "THROTTLED",
  "SUSPICIOUS",
]);

export const voteChoiceEnum = pgEnum("vote_choice", ["LEFT", "RIGHT", "SKIP"]);

export const voteStatusEnum = pgEnum("vote_status", [
  "VALID",
  "THROTTLED",
  "SUSPICIOUS",
  "REVOKED",
]);

export const productEventTypeEnum = pgEnum("product_event_type", [
  "PAGE_VIEW",
  "RANKING_VIEW",
  "PLAYER_VIEW",
  "VOTE_RESULT_VIEW",
  "NEXT_CLICK",
  "SHARE_CLICK",
]);

export const poolChangeTargetTypeEnum = pgEnum("pool_change_target_type", [
  "POOL_TEAM",
  "POOL_PLAYER",
  "PAIRING_STATE",
]);

export const moderationActionEnum = pgEnum("moderation_action", ["REVOKE_VOTE"]);

export const importChangeTypeEnum = pgEnum("import_change_type", [
  "TEAM",
  "PLAYER",
  "ROSTER",
  "EVENT",
  "POOL_TEAM",
  "POOL_PLAYER",
]);

export const importChangeStatusEnum = pgEnum("import_change_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
]);

export const externalProviderEnum = pgEnum("external_provider", [
  "HLTV",
  "LIQUIPEDIA",
  "PANDASCORE",
  "BO3",
  "OTHER",
]);

export const statPeriodTypeEnum = pgEnum("stat_period_type", ["LAST_3_MONTHS", "CAREER", "CUSTOM"]);

export const rankingSourceProviderEnum = pgEnum("ranking_source_provider", ["HLTV", "VALVE_VRS"]);

export const syncRunStatusEnum = pgEnum("sync_run_status", [
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "PARTIAL",
]);
