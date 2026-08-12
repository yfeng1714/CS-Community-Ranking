import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  ballotResolutionEnum,
  ballotStatusEnum,
  editionStatusEnum,
  externalProviderEnum,
  importChangeStatusEnum,
  importChangeTypeEnum,
  moderationActionEnum,
  playerAdmissionTypeEnum,
  productEventTypeEnum,
  professionalStatusEnum,
  poolChangeTargetTypeEnum,
  rankingEligibilityEnum,
  rankingSourceProviderEnum,
  rosterStatusEnum,
  statPeriodTypeEnum,
  syncRunStatusEnum,
  teamAdmissionTypeEnum,
  visitorRiskStateEnum,
  voteChoiceEnum,
  voteStatusEnum,
  whitelistReasonEnum,
} from "./enums.ts";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const identity = (name = "id") =>
  bigint(name, { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity();

const requiredTimestamp = (name: string) => timestamp(name, { withTimezone: true }).notNull();
const createdAt = () => requiredTimestamp("created_at").defaultNow();
const updatedAt = () => requiredTimestamp("updated_at").defaultNow();

export const adminUsers = pgTable(
  "admin_user",
  {
    id: identity(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("admin_user_username_unique").on(table.username),
    check("admin_user_username_not_blank", sql`length(btrim(${table.username})) > 0`),
    check("admin_user_password_hash_not_blank", sql`length(btrim(${table.passwordHash})) > 0`),
  ],
);

export const teams = pgTable(
  "team",
  {
    id: identity(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    countryCode: text("country_code"),
    logoPath: text("logo_path"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("team_slug_unique").on(table.slug),
    check("team_slug_not_blank", sql`length(btrim(${table.slug})) > 0`),
    check("team_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const players = pgTable(
  "player",
  {
    id: identity(),
    slug: text("slug").notNull(),
    nickname: text("nickname").notNull(),
    realName: text("real_name"),
    countryCode: text("country_code"),
    photoPath: text("photo_path"),
    professionalStatus: professionalStatusEnum("professional_status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("player_slug_unique").on(table.slug),
    check("player_slug_not_blank", sql`length(btrim(${table.slug})) > 0`),
    check("player_nickname_not_blank", sql`length(btrim(${table.nickname})) > 0`),
  ],
);

export const rosterMemberships = pgTable(
  "roster_membership",
  {
    id: identity(),
    playerId: bigint("player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    teamId: bigint("team_id", { mode: "bigint" })
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    status: rosterStatusEnum("status").notNull(),
    startsAt: date("starts_at", { mode: "string" }).notNull(),
    endsAt: date("ends_at", { mode: "string" }),
    source: text("source"),
  },
  (table) => [
    index("roster_team_current_idx").on(table.teamId, table.endsAt, table.status),
    index("roster_player_history_idx").on(table.playerId, table.startsAt),
    uniqueIndex("roster_one_current_per_player")
      .on(table.playerId)
      .where(sql`${table.endsAt} is null`),
    check(
      "roster_membership_date_order",
      sql`${table.endsAt} is null or ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

export const editions = pgTable(
  "edition",
  {
    id: identity(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: editionStatusEnum("status").notNull(),
    startsAt: requiredTimestamp("starts_at"),
    endsAt: requiredTimestamp("ends_at"),
    fullWeightBallotsPerDay: integer("full_weight_ballots_per_day").notNull().default(50),
    ballotTtlMinutes: integer("ballot_ttl_minutes").notNull().default(30),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("edition_code_unique").on(table.code),
    uniqueIndex("edition_single_active")
      .on(sql`(1)`)
      .where(sql`${table.status} = 'ACTIVE'`),
    check("edition_code_not_blank", sql`length(btrim(${table.code})) > 0`),
    check("edition_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("edition_date_order", sql`${table.endsAt} > ${table.startsAt}`),
    check("edition_daily_quota_nonnegative", sql`${table.fullWeightBallotsPerDay} >= 0`),
    check("edition_ballot_ttl_positive", sql`${table.ballotTtlMinutes} > 0`),
  ],
);

export const events = pgTable(
  "event",
  {
    id: identity(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    startsAt: date("starts_at", { mode: "string" }).notNull(),
    endsAt: date("ends_at", { mode: "string" }).notNull(),
    isMajor: boolean("is_major").notNull().default(false),
    isT1Whitelisted: boolean("is_t1_whitelisted").notNull().default(false),
    whitelistReason: whitelistReasonEnum("whitelist_reason").notNull().default("NONE"),
    whitelistNote: text("whitelist_note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: bigint("approved_by", { mode: "bigint" }).references(() => adminUsers.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    unique("event_slug_unique").on(table.slug),
    index("event_dates_idx").on(table.startsAt, table.endsAt),
    check("event_slug_not_blank", sql`length(btrim(${table.slug})) > 0`),
    check("event_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("event_date_order", sql`${table.endsAt} >= ${table.startsAt}`),
    check(
      "event_whitelist_approval",
      sql`not ${table.isT1Whitelisted} or (${table.whitelistReason} <> 'NONE' and ${table.approvedAt} is not null and ${table.approvedBy} is not null)`,
    ),
    check("event_major_reason", sql`not ${table.isMajor} or ${table.whitelistReason} = 'MAJOR'`),
  ],
);

export const eventTeamResults = pgTable(
  "event_team_result",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    teamId: bigint("team_id", { mode: "bigint" })
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    placementFrom: integer("placement_from").notNull(),
    placementTo: integer("placement_to").notNull(),
  },
  (table) => [
    primaryKey({
      name: "event_team_result_pk",
      columns: [table.eventId, table.teamId],
    }),
    index("event_team_result_team_idx").on(table.teamId, table.eventId),
    check("event_team_result_placement_positive", sql`${table.placementFrom} > 0`),
    check("event_team_result_placement_order", sql`${table.placementTo} >= ${table.placementFrom}`),
  ],
);

export const poolTeamEntries = pgTable(
  "pool_team_entry",
  {
    id: identity(),
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    teamId: bigint("team_id", { mode: "bigint" })
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    admissionType: teamAdmissionTypeEnum("admission_type").notNull(),
    admissionReason: text("admission_reason").notNull(),
    admittedAt: requiredTimestamp("admitted_at").defaultNow(),
    approvedBy: bigint("approved_by", { mode: "bigint" })
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
  },
  (table) => [
    unique("pool_team_edition_team_unique").on(table.editionId, table.teamId),
    index("pool_team_team_idx").on(table.teamId, table.editionId),
    check("pool_team_reason_not_blank", sql`length(btrim(${table.admissionReason})) > 0`),
  ],
);

export const poolPlayerEntries = pgTable(
  "pool_player_entry",
  {
    id: identity(),
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    playerId: bigint("player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    sourceTeamEntryId: bigint("source_team_entry_id", { mode: "bigint" }).references(
      () => poolTeamEntries.id,
      { onDelete: "restrict" },
    ),
    admissionType: playerAdmissionTypeEnum("admission_type").notNull(),
    admissionReason: text("admission_reason").notNull(),
    admittedAt: requiredTimestamp("admitted_at").defaultNow(),
    pairingEnabled: boolean("pairing_enabled").notNull().default(true),
    pairingDisabledAt: timestamp("pairing_disabled_at", { withTimezone: true }),
    pairingDisabledReason: text("pairing_disabled_reason"),
    approvedBy: bigint("approved_by", { mode: "bigint" })
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
  },
  (table) => [
    unique("pool_player_edition_player_unique").on(table.editionId, table.playerId),
    index("pool_player_active_pairing_idx")
      .on(table.editionId, table.playerId)
      .where(sql`${table.pairingEnabled} = true`),
    index("pool_player_source_team_idx").on(table.sourceTeamEntryId),
    check("pool_player_reason_not_blank", sql`length(btrim(${table.admissionReason})) > 0`),
    check(
      "pool_player_source_shape",
      sql`(${table.admissionType} = 'SPECIAL' and ${table.sourceTeamEntryId} is null) or (${table.admissionType} <> 'SPECIAL' and ${table.sourceTeamEntryId} is not null)`,
    ),
    check(
      "pool_player_pairing_state",
      sql`(${table.pairingEnabled} and ${table.pairingDisabledAt} is null and ${table.pairingDisabledReason} is null) or (not ${table.pairingEnabled} and ${table.pairingDisabledAt} is not null and length(btrim(${table.pairingDisabledReason})) > 0)`,
    ),
  ],
);

export const playerRankings = pgTable(
  "player_ranking",
  {
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    playerId: bigint("player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    score: integer("score").notNull().default(0),
    wins: bigint("wins", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    losses: bigint("losses", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    skips: bigint("skips", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ name: "player_ranking_pk", columns: [table.editionId, table.playerId] }),
    index("player_ranking_score_idx").on(table.editionId, table.score.desc()),
    check("player_ranking_wins_nonnegative", sql`${table.wins} >= 0`),
    check("player_ranking_losses_nonnegative", sql`${table.losses} >= 0`),
    check("player_ranking_skips_nonnegative", sql`${table.skips} >= 0`),
    check(
      "player_ranking_score_matches_record",
      sql`${table.score}::bigint = ${table.wins} - ${table.losses}`,
    ),
  ],
);

export const anonymousVisitors = pgTable(
  "anonymous_visitor",
  {
    id: identity(),
    tokenHash: bytea("token_hash").notNull(),
    createdAt: createdAt(),
    lastSeenAt: requiredTimestamp("last_seen_at").defaultNow(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    riskState: visitorRiskStateEnum("risk_state").notNull().default("NORMAL"),
  },
  (table) => [
    unique("anonymous_visitor_token_hash_unique").on(table.tokenHash),
    check("anonymous_visitor_token_hash_nonempty", sql`octet_length(${table.tokenHash}) > 0`),
    check("anonymous_visitor_last_seen_order", sql`${table.lastSeenAt} >= ${table.createdAt}`),
  ],
);

export const visitorDailyUsage = pgTable(
  "visitor_daily_usage",
  {
    visitorId: bigint("visitor_id", { mode: "bigint" })
      .notNull()
      .references(() => anonymousVisitors.id, { onDelete: "restrict" }),
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    usageDate: date("usage_date", { mode: "string" }).notNull(),
    ballotsIssued: integer("ballots_issued").notNull().default(0),
    validResolved: integer("valid_resolved").notNull().default(0),
    validSkips: integer("valid_skips").notNull().default(0),
    throttledResolved: integer("throttled_resolved").notNull().default(0),
    suspiciousResolved: integer("suspicious_resolved").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "visitor_daily_usage_pk",
      columns: [table.visitorId, table.editionId, table.usageDate],
    }),
    index("visitor_daily_usage_edition_date_idx").on(table.editionId, table.usageDate),
    check("visitor_usage_ballots_nonnegative", sql`${table.ballotsIssued} >= 0`),
    check("visitor_usage_valid_nonnegative", sql`${table.validResolved} >= 0`),
    check("visitor_usage_skips_nonnegative", sql`${table.validSkips} >= 0`),
    check("visitor_usage_throttled_nonnegative", sql`${table.throttledResolved} >= 0`),
    check("visitor_usage_suspicious_nonnegative", sql`${table.suspiciousResolved} >= 0`),
  ],
);

export const ballots = pgTable(
  "ballot",
  {
    id: identity(),
    publicId: uuid("public_id").notNull().defaultRandom(),
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    visitorId: bigint("visitor_id", { mode: "bigint" })
      .notNull()
      .references(() => anonymousVisitors.id, { onDelete: "restrict" }),
    player1Id: bigint("player_1_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    player2Id: bigint("player_2_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    leftPlayerId: bigint("left_player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    rightPlayerId: bigint("right_player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    issuedAt: requiredTimestamp("issued_at").defaultNow(),
    expiresAt: requiredTimestamp("expires_at"),
    usageDate: date("usage_date", { mode: "string" }).notNull(),
    status: ballotStatusEnum("status").notNull().default("OPEN"),
    resolution: ballotResolutionEnum("resolution"),
    rankingEligibility: rankingEligibilityEnum("ranking_eligibility").notNull(),
    dailyOrdinal: integer("daily_ordinal").notNull(),
    issuedIpRiskKey: bytea("issued_ip_risk_key"),
    riskReasonCodes: jsonb("risk_reason_codes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    unique("ballot_public_id_unique").on(table.publicId),
    uniqueIndex("ballot_one_open_per_visitor_edition")
      .on(table.visitorId, table.editionId)
      .where(sql`${table.status} = 'OPEN'`),
    unique("ballot_daily_ordinal_unique").on(
      table.visitorId,
      table.editionId,
      table.usageDate,
      table.dailyOrdinal,
    ),
    index("ballot_edition_issued_idx").on(table.editionId, table.issuedAt),
    index("ballot_pair_history_idx").on(
      table.editionId,
      table.player1Id,
      table.player2Id,
      table.issuedAt,
    ),
    check("ballot_canonical_pair", sql`${table.player1Id} < ${table.player2Id}`),
    check("ballot_distinct_orientation", sql`${table.leftPlayerId} <> ${table.rightPlayerId}`),
    check(
      "ballot_orientation_matches_pair",
      sql`(${table.leftPlayerId} = ${table.player1Id} and ${table.rightPlayerId} = ${table.player2Id}) or (${table.leftPlayerId} = ${table.player2Id} and ${table.rightPlayerId} = ${table.player1Id})`,
    ),
    check("ballot_expiry_order", sql`${table.expiresAt} > ${table.issuedAt}`),
    check("ballot_daily_ordinal_positive", sql`${table.dailyOrdinal} > 0`),
    check(
      "ballot_ip_risk_key_sha256",
      sql`${table.issuedIpRiskKey} is null or octet_length(${table.issuedIpRiskKey}) = 32`,
    ),
    check("ballot_risk_reasons_array", sql`jsonb_typeof(${table.riskReasonCodes}) = 'array'`),
    check(
      "ballot_resolution_state",
      sql`(${table.status} = 'OPEN' and ${table.resolution} is null and ${table.resolvedAt} is null) or (${table.status} = 'RESOLVED' and ${table.resolution} is not null and ${table.resolvedAt} is not null) or (${table.status} = 'EXPIRED' and ${table.resolution} is null and ${table.resolvedAt} is null)`,
    ),
  ],
);

export const votes = pgTable(
  "vote",
  {
    id: identity(),
    ballotId: bigint("ballot_id", { mode: "bigint" })
      .notNull()
      .references(() => ballots.id, { onDelete: "restrict" }),
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    visitorId: bigint("visitor_id", { mode: "bigint" })
      .notNull()
      .references(() => anonymousVisitors.id, { onDelete: "restrict" }),
    choice: voteChoiceEnum("choice").notNull(),
    winnerPlayerId: bigint("winner_player_id", { mode: "bigint" }).references(() => players.id, {
      onDelete: "restrict",
    }),
    loserPlayerId: bigint("loser_player_id", { mode: "bigint" }).references(() => players.id, {
      onDelete: "restrict",
    }),
    status: voteStatusEnum("status").notNull(),
    riskReasonCodes: jsonb("risk_reason_codes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ipRiskKey: bytea("ip_risk_key"),
    createdAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: bigint("revoked_by", { mode: "bigint" }).references(() => adminUsers.id, {
      onDelete: "restrict",
    }),
    revokedReason: text("revoked_reason"),
  },
  (table) => [
    unique("vote_ballot_unique").on(table.ballotId),
    index("vote_edition_created_idx").on(table.editionId, table.createdAt),
    index("vote_visitor_created_idx").on(table.visitorId, table.createdAt),
    check(
      "vote_choice_player_shape",
      sql`(${table.choice} = 'SKIP' and ${table.winnerPlayerId} is null and ${table.loserPlayerId} is null) or (${table.choice} <> 'SKIP' and ${table.winnerPlayerId} is not null and ${table.loserPlayerId} is not null and ${table.winnerPlayerId} <> ${table.loserPlayerId})`,
    ),
    check("vote_risk_reasons_array", sql`jsonb_typeof(${table.riskReasonCodes}) = 'array'`),
    check(
      "vote_ip_risk_key_sha256",
      sql`${table.ipRiskKey} is null or octet_length(${table.ipRiskKey}) = 32`,
    ),
    check(
      "vote_revocation_state",
      sql`(${table.status} = 'REVOKED' and ${table.revokedAt} is not null and ${table.revokedBy} is not null and length(btrim(${table.revokedReason})) > 0) or (${table.status} <> 'REVOKED' and ${table.revokedAt} is null and ${table.revokedBy} is null and ${table.revokedReason} is null)`,
    ),
  ],
);

export const pairAggregates = pgTable(
  "pair_aggregate",
  {
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    player1Id: bigint("player_1_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    player2Id: bigint("player_2_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    countedPlayer1Wins: bigint("counted_player_1_wins", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    countedPlayer2Wins: bigint("counted_player_2_wins", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    countedSkips: bigint("counted_skips", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    observedPlayer1Choices: bigint("observed_player_1_choices", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    observedPlayer2Choices: bigint("observed_player_2_choices", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    observedSkips: bigint("observed_skips", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      name: "pair_aggregate_pk",
      columns: [table.editionId, table.player1Id, table.player2Id],
    }),
    check("pair_aggregate_canonical_pair", sql`${table.player1Id} < ${table.player2Id}`),
    check("pair_counted_p1_nonnegative", sql`${table.countedPlayer1Wins} >= 0`),
    check("pair_counted_p2_nonnegative", sql`${table.countedPlayer2Wins} >= 0`),
    check("pair_counted_skips_nonnegative", sql`${table.countedSkips} >= 0`),
    check("pair_observed_p1_nonnegative", sql`${table.observedPlayer1Choices} >= 0`),
    check("pair_observed_p2_nonnegative", sql`${table.observedPlayer2Choices} >= 0`),
    check("pair_observed_skips_nonnegative", sql`${table.observedSkips} >= 0`),
    check(
      "pair_counted_p1_within_observed",
      sql`${table.countedPlayer1Wins} <= ${table.observedPlayer1Choices}`,
    ),
    check(
      "pair_counted_p2_within_observed",
      sql`${table.countedPlayer2Wins} <= ${table.observedPlayer2Choices}`,
    ),
    check(
      "pair_counted_skips_within_observed",
      sql`${table.countedSkips} <= ${table.observedSkips}`,
    ),
  ],
);

export const dailyRankingSnapshots = pgTable(
  "daily_ranking_snapshot",
  {
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    snapshotDate: date("snapshot_date", { mode: "string" }).notNull(),
    playerId: bigint("player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    rank: integer("rank").notNull(),
    score: integer("score").notNull(),
    wins: bigint("wins", { mode: "bigint" }).notNull(),
    losses: bigint("losses", { mode: "bigint" }).notNull(),
    skips: bigint("skips", { mode: "bigint" }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "daily_ranking_snapshot_pk",
      columns: [table.editionId, table.snapshotDate, table.playerId],
    }),
    index("daily_ranking_snapshot_rank_idx").on(table.editionId, table.snapshotDate, table.rank),
    check("daily_snapshot_rank_positive", sql`${table.rank} > 0`),
    check("daily_snapshot_wins_nonnegative", sql`${table.wins} >= 0`),
    check("daily_snapshot_losses_nonnegative", sql`${table.losses} >= 0`),
    check("daily_snapshot_skips_nonnegative", sql`${table.skips} >= 0`),
    check(
      "daily_snapshot_score_matches_record",
      sql`${table.score}::bigint = ${table.wins} - ${table.losses}`,
    ),
  ],
);

export const productEvents = pgTable(
  "product_event",
  {
    id: identity(),
    visitorId: bigint("visitor_id", { mode: "bigint" }).references(() => anonymousVisitors.id, {
      onDelete: "restrict",
    }),
    editionId: bigint("edition_id", { mode: "bigint" }).references(() => editions.id, {
      onDelete: "restrict",
    }),
    eventType: productEventTypeEnum("event_type").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: requiredTimestamp("occurred_at").defaultNow(),
  },
  (table) => [
    index("product_event_occurred_idx").on(table.occurredAt),
    index("product_event_edition_type_idx").on(table.editionId, table.eventType, table.occurredAt),
    check("product_event_metadata_object", sql`jsonb_typeof(${table.metadata}) = 'object'`),
  ],
);

export const riskObservations = pgTable(
  "risk_observation",
  {
    id: identity(),
    visitorId: bigint("visitor_id", { mode: "bigint" }).references(() => anonymousVisitors.id, {
      onDelete: "restrict",
    }),
    ipRiskKey: bytea("ip_risk_key"),
    reasonCode: text("reason_code").notNull(),
    route: text("route").notNull(),
    occurredAt: requiredTimestamp("occurred_at").defaultNow(),
  },
  (table) => [
    index("risk_observation_ip_occurred_idx").on(table.ipRiskKey, table.occurredAt),
    index("risk_observation_visitor_occurred_idx").on(table.visitorId, table.occurredAt),
    check("risk_observation_reason_code_safe", sql`${table.reasonCode} ~ '^[A-Z0-9_]{1,64}$'`),
    check("risk_observation_route_safe", sql`${table.route} ~ '^/[a-z0-9_/{}/-]{1,127}$'`),
    check(
      "risk_observation_has_pseudonymous_subject",
      sql`${table.visitorId} is not null or ${table.ipRiskKey} is not null`,
    ),
    check(
      "risk_observation_ip_risk_key_sha256",
      sql`${table.ipRiskKey} is null or octet_length(${table.ipRiskKey}) = 32`,
    ),
  ],
);

export const apiRequestMetrics = pgTable(
  "api_request_metric",
  {
    id: identity(),
    visitorId: bigint("visitor_id", { mode: "bigint" }).references(() => anonymousVisitors.id, {
      onDelete: "restrict",
    }),
    route: text("route").notNull(),
    statusCode: integer("status_code").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    errorCode: text("error_code"),
    occurredAt: requiredTimestamp("occurred_at").defaultNow(),
  },
  (table) => [
    index("api_request_metric_route_occurred_idx").on(table.route, table.occurredAt),
    check("api_request_metric_route_safe", sql`${table.route} ~ '^/[a-z0-9_/{}/-]{1,127}$'`),
    check(
      "api_request_metric_status_range",
      sql`${table.statusCode} >= 100 and ${table.statusCode} <= 599`,
    ),
    check("api_request_metric_latency_nonnegative", sql`${table.latencyMs} >= 0`),
    check(
      "api_request_metric_error_code_safe",
      sql`${table.errorCode} is null or ${table.errorCode} ~ '^[A-Z0-9_]{1,64}$'`,
    ),
  ],
);

export const poolChangeLogs = pgTable(
  "pool_change_log",
  {
    id: identity(),
    actorAdminUserId: bigint("actor_admin_user_id", { mode: "bigint" })
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
    editionId: bigint("edition_id", { mode: "bigint" })
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetType: poolChangeTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [
    index("pool_change_log_edition_created_idx").on(table.editionId, table.createdAt),
    check("pool_change_log_action_not_blank", sql`length(btrim(${table.action})) > 0`),
    check("pool_change_log_target_not_blank", sql`length(btrim(${table.targetId})) > 0`),
    check("pool_change_log_reason_not_blank", sql`length(btrim(${table.reason})) > 0`),
  ],
);

export const moderationAuditLogs = pgTable(
  "moderation_audit_log",
  {
    id: identity(),
    actorAdminUserId: bigint("actor_admin_user_id", { mode: "bigint" })
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
    action: moderationActionEnum("action").notNull(),
    voteId: bigint("vote_id", { mode: "bigint" })
      .notNull()
      .references(() => votes.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>().notNull(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("moderation_audit_vote_created_idx").on(table.voteId, table.createdAt),
    check("moderation_audit_reason_not_blank", sql`length(btrim(${table.reason})) > 0`),
  ],
);

export const adminSessions = pgTable(
  "admin_session",
  {
    id: identity(),
    adminUserId: bigint("admin_user_id", { mode: "bigint" })
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
    tokenHash: bytea("token_hash").notNull(),
    createdAt: createdAt(),
    expiresAt: requiredTimestamp("expires_at"),
    lastSeenAt: requiredTimestamp("last_seen_at").defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    unique("admin_session_token_hash_unique").on(table.tokenHash),
    index("admin_session_user_expires_idx").on(table.adminUserId, table.expiresAt),
    check("admin_session_token_hash_nonempty", sql`octet_length(${table.tokenHash}) > 0`),
    check("admin_session_expiry_order", sql`${table.expiresAt} > ${table.createdAt}`),
    check("admin_session_last_seen_order", sql`${table.lastSeenAt} >= ${table.createdAt}`),
    check(
      "admin_session_revoked_order",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const adminAuditLogs = pgTable(
  "admin_audit_log",
  {
    id: identity(),
    actorAdminUserId: bigint("actor_admin_user_id", { mode: "bigint" })
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [
    index("admin_audit_actor_created_idx").on(table.actorAdminUserId, table.createdAt),
    index("admin_audit_target_created_idx").on(table.targetType, table.targetId, table.createdAt),
    check("admin_audit_action_not_blank", sql`length(btrim(${table.action})) > 0`),
    check("admin_audit_target_type_not_blank", sql`length(btrim(${table.targetType})) > 0`),
    check("admin_audit_target_id_not_blank", sql`length(btrim(${table.targetId})) > 0`),
    check("admin_audit_reason_not_blank", sql`length(btrim(${table.reason})) > 0`),
  ],
);

export const syncRuns = pgTable(
  "sync_run",
  {
    id: identity(),
    jobName: text("job_name").notNull(),
    provider: text("provider").notNull(),
    startedAt: requiredTimestamp("started_at").defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: syncRunStatusEnum("status").notNull(),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsChanged: integer("records_changed").notNull().default(0),
    errorSummary: text("error_summary"),
    sourceFreshnessAt: timestamp("source_freshness_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("sync_run_job_started_idx").on(table.jobName, table.startedAt),
    check("sync_run_job_not_blank", sql`length(btrim(${table.jobName})) > 0`),
    check("sync_run_provider_not_blank", sql`length(btrim(${table.provider})) > 0`),
    check("sync_run_records_seen_nonnegative", sql`${table.recordsSeen} >= 0`),
    check("sync_run_records_changed_nonnegative", sql`${table.recordsChanged} >= 0`),
    check("sync_run_metadata_object", sql`jsonb_typeof(${table.metadata}) = 'object'`),
    check(
      "sync_run_lifecycle",
      sql`(${table.status} = 'RUNNING' and ${table.finishedAt} is null) or (${table.status} <> 'RUNNING' and ${table.finishedAt} is not null and ${table.finishedAt} >= ${table.startedAt})`,
    ),
  ],
);

export const pendingImportChanges = pgTable(
  "pending_import_change",
  {
    id: identity(),
    syncRunId: bigint("sync_run_id", { mode: "bigint" })
      .notNull()
      .references(() => syncRuns.id, { onDelete: "restrict" }),
    editionId: bigint("edition_id", { mode: "bigint" }).references(() => editions.id, {
      onDelete: "restrict",
    }),
    changeType: importChangeTypeEnum("change_type").notNull(),
    targetExternalKey: text("target_external_key").notNull(),
    proposedData: jsonb("proposed_data").$type<Record<string, unknown>>().notNull(),
    conflictCodes: jsonb("conflict_codes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: importChangeStatusEnum("status").notNull().default("PENDING"),
    createdAt: createdAt(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: bigint("reviewed_by", { mode: "bigint" }).references(() => adminUsers.id, {
      onDelete: "restrict",
    }),
    reviewReason: text("review_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (table) => [
    index("pending_import_status_created_idx").on(table.status, table.createdAt),
    index("pending_import_sync_run_idx").on(table.syncRunId, table.createdAt),
    check("pending_import_target_not_blank", sql`length(btrim(${table.targetExternalKey})) > 0`),
    check("pending_import_data_object", sql`jsonb_typeof(${table.proposedData}) = 'object'`),
    check("pending_import_conflicts_array", sql`jsonb_typeof(${table.conflictCodes}) = 'array'`),
    check(
      "pending_import_review_state",
      sql`(${table.status} = 'PENDING' and ${table.reviewedAt} is null and ${table.reviewedBy} is null and ${table.reviewReason} is null and ${table.appliedAt} is null) or (${table.status} = 'APPROVED' and ${table.reviewedAt} is not null and ${table.reviewedBy} is not null and length(btrim(${table.reviewReason})) > 0 and ${table.appliedAt} is not null) or (${table.status} = 'REJECTED' and ${table.reviewedAt} is not null and ${table.reviewedBy} is not null and length(btrim(${table.reviewReason})) > 0 and ${table.appliedAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.appliedAt} is null)`,
    ),
  ],
);

export const playerExternalIdentities = pgTable(
  "player_external_identity",
  {
    playerId: bigint("player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    provider: externalProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    externalSlug: text("external_slug"),
    sourceUrl: text("source_url").notNull(),
    lastVerifiedAt: requiredTimestamp("last_verified_at"),
  },
  (table) => [
    primaryKey({
      name: "player_external_identity_pk",
      columns: [table.playerId, table.provider],
    }),
    unique("player_external_provider_id_unique").on(table.provider, table.externalId),
    check("player_external_id_not_blank", sql`length(btrim(${table.externalId})) > 0`),
    check("player_external_source_not_blank", sql`length(btrim(${table.sourceUrl})) > 0`),
  ],
);

export const teamExternalIdentities = pgTable(
  "team_external_identity",
  {
    teamId: bigint("team_id", { mode: "bigint" })
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    provider: externalProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    externalSlug: text("external_slug"),
    sourceUrl: text("source_url").notNull(),
    lastVerifiedAt: requiredTimestamp("last_verified_at"),
  },
  (table) => [
    primaryKey({
      name: "team_external_identity_pk",
      columns: [table.teamId, table.provider],
    }),
    unique("team_external_provider_id_unique").on(table.provider, table.externalId),
    check("team_external_id_not_blank", sql`length(btrim(${table.externalId})) > 0`),
    check("team_external_source_not_blank", sql`length(btrim(${table.sourceUrl})) > 0`),
  ],
);

export const playerStatSnapshots = pgTable(
  "player_stat_snapshot",
  {
    id: identity(),
    playerId: bigint("player_id", { mode: "bigint" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    provider: externalProviderEnum("provider").notNull(),
    metric: text("metric").notNull(),
    periodType: statPeriodTypeEnum("period_type").notNull(),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    value: numeric("value").notNull(),
    maps: integer("maps"),
    capturedAt: requiredTimestamp("captured_at"),
    sourceUrl: text("source_url").notNull(),
  },
  (table) => [
    index("player_stat_latest_idx").on(
      table.playerId,
      table.provider,
      table.metric,
      table.periodType,
      table.capturedAt.desc(),
    ),
    check("player_stat_metric_not_blank", sql`length(btrim(${table.metric})) > 0`),
    check("player_stat_maps_nonnegative", sql`${table.maps} is null or ${table.maps} >= 0`),
    check(
      "player_stat_period_order",
      sql`${table.periodStart} is null or ${table.periodEnd} is null or ${table.periodEnd} >= ${table.periodStart}`,
    ),
    check("player_stat_source_not_blank", sql`length(btrim(${table.sourceUrl})) > 0`),
  ],
);

export const rankingSourceSnapshots = pgTable(
  "ranking_source_snapshot",
  {
    id: identity(),
    provider: rankingSourceProviderEnum("provider").notNull(),
    capturedAt: requiredTimestamp("captured_at"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    parserVersion: text("parser_version").notNull(),
    normalizedData: jsonb("normalized_data").notNull(),
    rawChecksum: text("raw_checksum").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: bigint("approved_by", { mode: "bigint" }).references(() => adminUsers.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    index("ranking_source_provider_captured_idx").on(table.provider, table.capturedAt.desc()),
    check("ranking_source_parser_not_blank", sql`length(btrim(${table.parserVersion})) > 0`),
    check("ranking_source_checksum_not_blank", sql`length(btrim(${table.rawChecksum})) > 0`),
    check(
      "ranking_source_approval_shape",
      sql`(${table.approvedAt} is null and ${table.approvedBy} is null) or (${table.approvedAt} is not null and ${table.approvedBy} is not null)`,
    ),
  ],
);
