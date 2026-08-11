CREATE TYPE "public"."ballot_resolution" AS ENUM('LEFT', 'RIGHT', 'SKIP');--> statement-breakpoint
CREATE TYPE "public"."ballot_status" AS ENUM('OPEN', 'RESOLVED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."edition_status" AS ENUM('DRAFT', 'ACTIVE', 'FROZEN', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."external_provider" AS ENUM('HLTV', 'LIQUIPEDIA', 'PANDASCORE', 'BO3', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."import_change_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."import_change_type" AS ENUM('TEAM', 'PLAYER', 'ROSTER', 'EVENT', 'POOL_TEAM', 'POOL_PLAYER');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('REVOKE_VOTE');--> statement-breakpoint
CREATE TYPE "public"."player_admission_type" AS ENUM('CORE', 'REVIEW_AUTO', 'REVIEW_MANUAL', 'SPECIAL');--> statement-breakpoint
CREATE TYPE "public"."pool_change_target_type" AS ENUM('POOL_TEAM', 'POOL_PLAYER', 'PAIRING_STATE');--> statement-breakpoint
CREATE TYPE "public"."product_event_type" AS ENUM('PAGE_VIEW', 'RANKING_VIEW', 'PLAYER_VIEW', 'VOTE_RESULT_VIEW', 'NEXT_CLICK', 'SHARE_CLICK');--> statement-breakpoint
CREATE TYPE "public"."professional_status" AS ENUM('ACTIVE', 'INACTIVE', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."ranking_eligibility" AS ENUM('ELIGIBLE', 'THROTTLED', 'SUSPICIOUS');--> statement-breakpoint
CREATE TYPE "public"."ranking_source_provider" AS ENUM('HLTV', 'VALVE_VRS');--> statement-breakpoint
CREATE TYPE "public"."roster_status" AS ENUM('STARTER', 'BENCH', 'STAND_IN');--> statement-breakpoint
CREATE TYPE "public"."stat_period_type" AS ENUM('LAST_3_MONTHS', 'CAREER', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."sync_run_status" AS ENUM('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."team_admission_type" AS ENUM('CORE', 'REVIEW_AUTO', 'REVIEW_MANUAL');--> statement-breakpoint
CREATE TYPE "public"."visitor_risk_state" AS ENUM('NORMAL', 'WATCH', 'SUSPICIOUS');--> statement-breakpoint
CREATE TYPE "public"."vote_choice" AS ENUM('LEFT', 'RIGHT', 'SKIP');--> statement-breakpoint
CREATE TYPE "public"."vote_status" AS ENUM('VALID', 'THROTTLED', 'SUSPICIOUS', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."whitelist_reason" AS ENUM('MAJOR', 'HLTV_HIGHLIGHT', 'MANUAL', 'NONE');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_admin_user_id" bigint NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_action_not_blank" CHECK (length(btrim("admin_audit_log"."action")) > 0),
	CONSTRAINT "admin_audit_target_type_not_blank" CHECK (length(btrim("admin_audit_log"."target_type")) > 0),
	CONSTRAINT "admin_audit_target_id_not_blank" CHECK (length(btrim("admin_audit_log"."target_id")) > 0),
	CONSTRAINT "admin_audit_reason_not_blank" CHECK (length(btrim("admin_audit_log"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "admin_session" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_session_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"admin_user_id" bigint NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_session_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "admin_session_token_hash_nonempty" CHECK (octet_length("admin_session"."token_hash") > 0),
	CONSTRAINT "admin_session_expiry_order" CHECK ("admin_session"."expires_at" > "admin_session"."created_at"),
	CONSTRAINT "admin_session_last_seen_order" CHECK ("admin_session"."last_seen_at" >= "admin_session"."created_at"),
	CONSTRAINT "admin_session_revoked_order" CHECK ("admin_session"."revoked_at" is null or "admin_session"."revoked_at" >= "admin_session"."created_at")
);
--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_user_username_unique" UNIQUE("username"),
	CONSTRAINT "admin_user_username_not_blank" CHECK (length(btrim("admin_user"."username")) > 0),
	CONSTRAINT "admin_user_password_hash_not_blank" CHECK (length(btrim("admin_user"."password_hash")) > 0)
);
--> statement-breakpoint
CREATE TABLE "anonymous_visitor" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "anonymous_visitor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	"risk_state" "visitor_risk_state" DEFAULT 'NORMAL' NOT NULL,
	CONSTRAINT "anonymous_visitor_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "anonymous_visitor_token_hash_nonempty" CHECK (octet_length("anonymous_visitor"."token_hash") > 0),
	CONSTRAINT "anonymous_visitor_last_seen_order" CHECK ("anonymous_visitor"."last_seen_at" >= "anonymous_visitor"."created_at")
);
--> statement-breakpoint
CREATE TABLE "ballot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ballot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" bigint NOT NULL,
	"visitor_id" bigint NOT NULL,
	"player_1_id" bigint NOT NULL,
	"player_2_id" bigint NOT NULL,
	"left_player_id" bigint NOT NULL,
	"right_player_id" bigint NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"usage_date" date NOT NULL,
	"status" "ballot_status" DEFAULT 'OPEN' NOT NULL,
	"resolution" "ballot_resolution",
	"ranking_eligibility" "ranking_eligibility" NOT NULL,
	"daily_ordinal" integer NOT NULL,
	"issued_ip_risk_key" "bytea",
	"resolved_at" timestamp with time zone,
	CONSTRAINT "ballot_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "ballot_daily_ordinal_unique" UNIQUE("visitor_id","edition_id","usage_date","daily_ordinal"),
	CONSTRAINT "ballot_canonical_pair" CHECK ("ballot"."player_1_id" < "ballot"."player_2_id"),
	CONSTRAINT "ballot_distinct_orientation" CHECK ("ballot"."left_player_id" <> "ballot"."right_player_id"),
	CONSTRAINT "ballot_orientation_matches_pair" CHECK (("ballot"."left_player_id" = "ballot"."player_1_id" and "ballot"."right_player_id" = "ballot"."player_2_id") or ("ballot"."left_player_id" = "ballot"."player_2_id" and "ballot"."right_player_id" = "ballot"."player_1_id")),
	CONSTRAINT "ballot_expiry_order" CHECK ("ballot"."expires_at" > "ballot"."issued_at"),
	CONSTRAINT "ballot_daily_ordinal_positive" CHECK ("ballot"."daily_ordinal" > 0),
	CONSTRAINT "ballot_resolution_state" CHECK (("ballot"."status" = 'OPEN' and "ballot"."resolution" is null and "ballot"."resolved_at" is null) or ("ballot"."status" = 'RESOLVED' and "ballot"."resolution" is not null and "ballot"."resolved_at" is not null) or ("ballot"."status" = 'EXPIRED' and "ballot"."resolution" is null and "ballot"."resolved_at" is null))
);
--> statement-breakpoint
CREATE TABLE "daily_ranking_snapshot" (
	"edition_id" bigint NOT NULL,
	"snapshot_date" date NOT NULL,
	"player_id" bigint NOT NULL,
	"rank" integer NOT NULL,
	"score" integer NOT NULL,
	"wins" bigint NOT NULL,
	"losses" bigint NOT NULL,
	"skips" bigint NOT NULL,
	CONSTRAINT "daily_ranking_snapshot_pk" PRIMARY KEY("edition_id","snapshot_date","player_id"),
	CONSTRAINT "daily_snapshot_rank_positive" CHECK ("daily_ranking_snapshot"."rank" > 0),
	CONSTRAINT "daily_snapshot_wins_nonnegative" CHECK ("daily_ranking_snapshot"."wins" >= 0),
	CONSTRAINT "daily_snapshot_losses_nonnegative" CHECK ("daily_ranking_snapshot"."losses" >= 0),
	CONSTRAINT "daily_snapshot_skips_nonnegative" CHECK ("daily_ranking_snapshot"."skips" >= 0),
	CONSTRAINT "daily_snapshot_score_matches_record" CHECK ("daily_ranking_snapshot"."score"::bigint = "daily_ranking_snapshot"."wins" - "daily_ranking_snapshot"."losses")
);
--> statement-breakpoint
CREATE TABLE "edition" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "edition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "edition_status" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"full_weight_ballots_per_day" integer DEFAULT 50 NOT NULL,
	"ballot_ttl_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edition_code_unique" UNIQUE("code"),
	CONSTRAINT "edition_code_not_blank" CHECK (length(btrim("edition"."code")) > 0),
	CONSTRAINT "edition_name_not_blank" CHECK (length(btrim("edition"."name")) > 0),
	CONSTRAINT "edition_date_order" CHECK ("edition"."ends_at" > "edition"."starts_at"),
	CONSTRAINT "edition_daily_quota_nonnegative" CHECK ("edition"."full_weight_ballots_per_day" >= 0),
	CONSTRAINT "edition_ballot_ttl_positive" CHECK ("edition"."ballot_ttl_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "event_team_result" (
	"event_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"placement_from" integer NOT NULL,
	"placement_to" integer NOT NULL,
	CONSTRAINT "event_team_result_pk" PRIMARY KEY("event_id","team_id"),
	CONSTRAINT "event_team_result_placement_positive" CHECK ("event_team_result"."placement_from" > 0),
	CONSTRAINT "event_team_result_placement_order" CHECK ("event_team_result"."placement_to" >= "event_team_result"."placement_from")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date NOT NULL,
	"is_major" boolean DEFAULT false NOT NULL,
	"is_t1_whitelisted" boolean DEFAULT false NOT NULL,
	"whitelist_reason" "whitelist_reason" DEFAULT 'NONE' NOT NULL,
	"whitelist_note" text,
	"approved_at" timestamp with time zone,
	"approved_by" bigint,
	CONSTRAINT "event_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_slug_not_blank" CHECK (length(btrim("event"."slug")) > 0),
	CONSTRAINT "event_name_not_blank" CHECK (length(btrim("event"."name")) > 0),
	CONSTRAINT "event_date_order" CHECK ("event"."ends_at" >= "event"."starts_at"),
	CONSTRAINT "event_whitelist_approval" CHECK (not "event"."is_t1_whitelisted" or ("event"."whitelist_reason" <> 'NONE' and "event"."approved_at" is not null and "event"."approved_by" is not null)),
	CONSTRAINT "event_major_reason" CHECK (not "event"."is_major" or "event"."whitelist_reason" = 'MAJOR')
);
--> statement-breakpoint
CREATE TABLE "moderation_audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "moderation_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_admin_user_id" bigint NOT NULL,
	"action" "moderation_action" NOT NULL,
	"vote_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_audit_reason_not_blank" CHECK (length(btrim("moderation_audit_log"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "pair_aggregate" (
	"edition_id" bigint NOT NULL,
	"player_1_id" bigint NOT NULL,
	"player_2_id" bigint NOT NULL,
	"counted_player_1_wins" bigint DEFAULT 0 NOT NULL,
	"counted_player_2_wins" bigint DEFAULT 0 NOT NULL,
	"counted_skips" bigint DEFAULT 0 NOT NULL,
	"observed_player_1_choices" bigint DEFAULT 0 NOT NULL,
	"observed_player_2_choices" bigint DEFAULT 0 NOT NULL,
	"observed_skips" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pair_aggregate_pk" PRIMARY KEY("edition_id","player_1_id","player_2_id"),
	CONSTRAINT "pair_aggregate_canonical_pair" CHECK ("pair_aggregate"."player_1_id" < "pair_aggregate"."player_2_id"),
	CONSTRAINT "pair_counted_p1_nonnegative" CHECK ("pair_aggregate"."counted_player_1_wins" >= 0),
	CONSTRAINT "pair_counted_p2_nonnegative" CHECK ("pair_aggregate"."counted_player_2_wins" >= 0),
	CONSTRAINT "pair_counted_skips_nonnegative" CHECK ("pair_aggregate"."counted_skips" >= 0),
	CONSTRAINT "pair_observed_p1_nonnegative" CHECK ("pair_aggregate"."observed_player_1_choices" >= 0),
	CONSTRAINT "pair_observed_p2_nonnegative" CHECK ("pair_aggregate"."observed_player_2_choices" >= 0),
	CONSTRAINT "pair_observed_skips_nonnegative" CHECK ("pair_aggregate"."observed_skips" >= 0),
	CONSTRAINT "pair_counted_p1_within_observed" CHECK ("pair_aggregate"."counted_player_1_wins" <= "pair_aggregate"."observed_player_1_choices"),
	CONSTRAINT "pair_counted_p2_within_observed" CHECK ("pair_aggregate"."counted_player_2_wins" <= "pair_aggregate"."observed_player_2_choices"),
	CONSTRAINT "pair_counted_skips_within_observed" CHECK ("pair_aggregate"."counted_skips" <= "pair_aggregate"."observed_skips")
);
--> statement-breakpoint
CREATE TABLE "pending_import_change" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pending_import_change_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sync_run_id" bigint NOT NULL,
	"edition_id" bigint,
	"change_type" "import_change_type" NOT NULL,
	"target_external_key" text NOT NULL,
	"proposed_data" jsonb NOT NULL,
	"conflict_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "import_change_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" bigint,
	"review_reason" text,
	"applied_at" timestamp with time zone,
	CONSTRAINT "pending_import_target_not_blank" CHECK (length(btrim("pending_import_change"."target_external_key")) > 0),
	CONSTRAINT "pending_import_data_object" CHECK (jsonb_typeof("pending_import_change"."proposed_data") = 'object'),
	CONSTRAINT "pending_import_conflicts_array" CHECK (jsonb_typeof("pending_import_change"."conflict_codes") = 'array'),
	CONSTRAINT "pending_import_review_state" CHECK (("pending_import_change"."status" = 'PENDING' and "pending_import_change"."reviewed_at" is null and "pending_import_change"."reviewed_by" is null and "pending_import_change"."review_reason" is null and "pending_import_change"."applied_at" is null) or ("pending_import_change"."status" = 'APPROVED' and "pending_import_change"."reviewed_at" is not null and "pending_import_change"."reviewed_by" is not null and length(btrim("pending_import_change"."review_reason")) > 0 and "pending_import_change"."applied_at" is not null) or ("pending_import_change"."status" = 'REJECTED' and "pending_import_change"."reviewed_at" is not null and "pending_import_change"."reviewed_by" is not null and length(btrim("pending_import_change"."review_reason")) > 0 and "pending_import_change"."applied_at" is null) or ("pending_import_change"."status" = 'SUPERSEDED' and "pending_import_change"."applied_at" is null))
);
--> statement-breakpoint
CREATE TABLE "player_external_identity" (
	"player_id" bigint NOT NULL,
	"provider" "external_provider" NOT NULL,
	"external_id" text NOT NULL,
	"external_slug" text,
	"source_url" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "player_external_identity_pk" PRIMARY KEY("player_id","provider"),
	CONSTRAINT "player_external_provider_id_unique" UNIQUE("provider","external_id"),
	CONSTRAINT "player_external_id_not_blank" CHECK (length(btrim("player_external_identity"."external_id")) > 0),
	CONSTRAINT "player_external_source_not_blank" CHECK (length(btrim("player_external_identity"."source_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "player_ranking" (
	"edition_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"wins" bigint DEFAULT 0 NOT NULL,
	"losses" bigint DEFAULT 0 NOT NULL,
	"skips" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_ranking_pk" PRIMARY KEY("edition_id","player_id"),
	CONSTRAINT "player_ranking_wins_nonnegative" CHECK ("player_ranking"."wins" >= 0),
	CONSTRAINT "player_ranking_losses_nonnegative" CHECK ("player_ranking"."losses" >= 0),
	CONSTRAINT "player_ranking_skips_nonnegative" CHECK ("player_ranking"."skips" >= 0),
	CONSTRAINT "player_ranking_score_matches_record" CHECK ("player_ranking"."score"::bigint = "player_ranking"."wins" - "player_ranking"."losses")
);
--> statement-breakpoint
CREATE TABLE "player_stat_snapshot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_stat_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"player_id" bigint NOT NULL,
	"provider" "external_provider" NOT NULL,
	"metric" text NOT NULL,
	"period_type" "stat_period_type" NOT NULL,
	"period_start" date,
	"period_end" date,
	"value" numeric NOT NULL,
	"maps" integer,
	"captured_at" timestamp with time zone NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "player_stat_metric_not_blank" CHECK (length(btrim("player_stat_snapshot"."metric")) > 0),
	CONSTRAINT "player_stat_maps_nonnegative" CHECK ("player_stat_snapshot"."maps" is null or "player_stat_snapshot"."maps" >= 0),
	CONSTRAINT "player_stat_period_order" CHECK ("player_stat_snapshot"."period_start" is null or "player_stat_snapshot"."period_end" is null or "player_stat_snapshot"."period_end" >= "player_stat_snapshot"."period_start"),
	CONSTRAINT "player_stat_source_not_blank" CHECK (length(btrim("player_stat_snapshot"."source_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"nickname" text NOT NULL,
	"real_name" text,
	"country_code" text,
	"photo_path" text,
	"professional_status" "professional_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_slug_unique" UNIQUE("slug"),
	CONSTRAINT "player_slug_not_blank" CHECK (length(btrim("player"."slug")) > 0),
	CONSTRAINT "player_nickname_not_blank" CHECK (length(btrim("player"."nickname")) > 0)
);
--> statement-breakpoint
CREATE TABLE "pool_change_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pool_change_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_admin_user_id" bigint NOT NULL,
	"edition_id" bigint NOT NULL,
	"action" text NOT NULL,
	"target_type" "pool_change_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pool_change_log_action_not_blank" CHECK (length(btrim("pool_change_log"."action")) > 0),
	CONSTRAINT "pool_change_log_target_not_blank" CHECK (length(btrim("pool_change_log"."target_id")) > 0),
	CONSTRAINT "pool_change_log_reason_not_blank" CHECK (length(btrim("pool_change_log"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "pool_player_entry" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pool_player_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"edition_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"source_team_entry_id" bigint,
	"admission_type" "player_admission_type" NOT NULL,
	"admission_reason" text NOT NULL,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pairing_enabled" boolean DEFAULT true NOT NULL,
	"pairing_disabled_at" timestamp with time zone,
	"pairing_disabled_reason" text,
	"approved_by" bigint NOT NULL,
	CONSTRAINT "pool_player_edition_player_unique" UNIQUE("edition_id","player_id"),
	CONSTRAINT "pool_player_reason_not_blank" CHECK (length(btrim("pool_player_entry"."admission_reason")) > 0),
	CONSTRAINT "pool_player_source_shape" CHECK (("pool_player_entry"."admission_type" = 'SPECIAL' and "pool_player_entry"."source_team_entry_id" is null) or ("pool_player_entry"."admission_type" <> 'SPECIAL' and "pool_player_entry"."source_team_entry_id" is not null)),
	CONSTRAINT "pool_player_pairing_state" CHECK (("pool_player_entry"."pairing_enabled" and "pool_player_entry"."pairing_disabled_at" is null and "pool_player_entry"."pairing_disabled_reason" is null) or (not "pool_player_entry"."pairing_enabled" and "pool_player_entry"."pairing_disabled_at" is not null and length(btrim("pool_player_entry"."pairing_disabled_reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "pool_team_entry" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pool_team_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"edition_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"admission_type" "team_admission_type" NOT NULL,
	"admission_reason" text NOT NULL,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" bigint NOT NULL,
	CONSTRAINT "pool_team_edition_team_unique" UNIQUE("edition_id","team_id"),
	CONSTRAINT "pool_team_reason_not_blank" CHECK (length(btrim("pool_team_entry"."admission_reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "product_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"visitor_id" bigint,
	"edition_id" bigint,
	"event_type" "product_event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_event_metadata_object" CHECK (jsonb_typeof("product_event"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "ranking_source_snapshot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ranking_source_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" "ranking_source_provider" NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"parser_version" text NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"raw_checksum" text NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" bigint,
	CONSTRAINT "ranking_source_parser_not_blank" CHECK (length(btrim("ranking_source_snapshot"."parser_version")) > 0),
	CONSTRAINT "ranking_source_checksum_not_blank" CHECK (length(btrim("ranking_source_snapshot"."raw_checksum")) > 0),
	CONSTRAINT "ranking_source_approval_shape" CHECK (("ranking_source_snapshot"."approved_at" is null and "ranking_source_snapshot"."approved_by" is null) or ("ranking_source_snapshot"."approved_at" is not null and "ranking_source_snapshot"."approved_by" is not null))
);
--> statement-breakpoint
CREATE TABLE "roster_membership" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roster_membership_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"player_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"status" "roster_status" NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date,
	"source" text,
	CONSTRAINT "roster_membership_date_order" CHECK ("roster_membership"."ends_at" is null or "roster_membership"."ends_at" >= "roster_membership"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_name" text NOT NULL,
	"provider" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "sync_run_status" NOT NULL,
	"records_seen" integer DEFAULT 0 NOT NULL,
	"records_changed" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"source_freshness_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "sync_run_job_not_blank" CHECK (length(btrim("sync_run"."job_name")) > 0),
	CONSTRAINT "sync_run_provider_not_blank" CHECK (length(btrim("sync_run"."provider")) > 0),
	CONSTRAINT "sync_run_records_seen_nonnegative" CHECK ("sync_run"."records_seen" >= 0),
	CONSTRAINT "sync_run_records_changed_nonnegative" CHECK ("sync_run"."records_changed" >= 0),
	CONSTRAINT "sync_run_metadata_object" CHECK (jsonb_typeof("sync_run"."metadata") = 'object'),
	CONSTRAINT "sync_run_lifecycle" CHECK (("sync_run"."status" = 'RUNNING' and "sync_run"."finished_at" is null) or ("sync_run"."status" <> 'RUNNING' and "sync_run"."finished_at" is not null and "sync_run"."finished_at" >= "sync_run"."started_at"))
);
--> statement-breakpoint
CREATE TABLE "team_external_identity" (
	"team_id" bigint NOT NULL,
	"provider" "external_provider" NOT NULL,
	"external_id" text NOT NULL,
	"external_slug" text,
	"source_url" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "team_external_identity_pk" PRIMARY KEY("team_id","provider"),
	CONSTRAINT "team_external_provider_id_unique" UNIQUE("provider","external_id"),
	CONSTRAINT "team_external_id_not_blank" CHECK (length(btrim("team_external_identity"."external_id")) > 0),
	CONSTRAINT "team_external_source_not_blank" CHECK (length(btrim("team_external_identity"."source_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"country_code" text,
	"logo_path" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_slug_unique" UNIQUE("slug"),
	CONSTRAINT "team_slug_not_blank" CHECK (length(btrim("team"."slug")) > 0),
	CONSTRAINT "team_name_not_blank" CHECK (length(btrim("team"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "visitor_daily_usage" (
	"visitor_id" bigint NOT NULL,
	"edition_id" bigint NOT NULL,
	"usage_date" date NOT NULL,
	"ballots_issued" integer DEFAULT 0 NOT NULL,
	"valid_resolved" integer DEFAULT 0 NOT NULL,
	"valid_skips" integer DEFAULT 0 NOT NULL,
	"throttled_resolved" integer DEFAULT 0 NOT NULL,
	"suspicious_resolved" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "visitor_daily_usage_pk" PRIMARY KEY("visitor_id","edition_id","usage_date"),
	CONSTRAINT "visitor_usage_ballots_nonnegative" CHECK ("visitor_daily_usage"."ballots_issued" >= 0),
	CONSTRAINT "visitor_usage_valid_nonnegative" CHECK ("visitor_daily_usage"."valid_resolved" >= 0),
	CONSTRAINT "visitor_usage_skips_nonnegative" CHECK ("visitor_daily_usage"."valid_skips" >= 0),
	CONSTRAINT "visitor_usage_throttled_nonnegative" CHECK ("visitor_daily_usage"."throttled_resolved" >= 0),
	CONSTRAINT "visitor_usage_suspicious_nonnegative" CHECK ("visitor_daily_usage"."suspicious_resolved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vote_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ballot_id" bigint NOT NULL,
	"edition_id" bigint NOT NULL,
	"visitor_id" bigint NOT NULL,
	"choice" "vote_choice" NOT NULL,
	"winner_player_id" bigint,
	"loser_player_id" bigint,
	"status" "vote_status" NOT NULL,
	"risk_reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ip_risk_key" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" bigint,
	"revoked_reason" text,
	CONSTRAINT "vote_ballot_unique" UNIQUE("ballot_id"),
	CONSTRAINT "vote_choice_player_shape" CHECK (("vote"."choice" = 'SKIP' and "vote"."winner_player_id" is null and "vote"."loser_player_id" is null) or ("vote"."choice" <> 'SKIP' and "vote"."winner_player_id" is not null and "vote"."loser_player_id" is not null and "vote"."winner_player_id" <> "vote"."loser_player_id")),
	CONSTRAINT "vote_risk_reasons_array" CHECK (jsonb_typeof("vote"."risk_reason_codes") = 'array'),
	CONSTRAINT "vote_revocation_state" CHECK (("vote"."status" = 'REVOKED' and "vote"."revoked_at" is not null and "vote"."revoked_by" is not null and length(btrim("vote"."revoked_reason")) > 0) or ("vote"."status" <> 'REVOKED' and "vote"."revoked_at" is null and "vote"."revoked_by" is null and "vote"."revoked_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_admin_user_id_admin_user_id_fk" FOREIGN KEY ("actor_admin_user_id") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_admin_user_id_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_visitor_id_anonymous_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."anonymous_visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_player_1_id_player_id_fk" FOREIGN KEY ("player_1_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_player_2_id_player_id_fk" FOREIGN KEY ("player_2_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_left_player_id_player_id_fk" FOREIGN KEY ("left_player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_right_player_id_player_id_fk" FOREIGN KEY ("right_player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_ranking_snapshot" ADD CONSTRAINT "daily_ranking_snapshot_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_ranking_snapshot" ADD CONSTRAINT "daily_ranking_snapshot_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_team_result" ADD CONSTRAINT "event_team_result_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_team_result" ADD CONSTRAINT "event_team_result_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_approved_by_admin_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_actor_admin_user_id_admin_user_id_fk" FOREIGN KEY ("actor_admin_user_id") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_vote_id_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_aggregate" ADD CONSTRAINT "pair_aggregate_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_aggregate" ADD CONSTRAINT "pair_aggregate_player_1_id_player_id_fk" FOREIGN KEY ("player_1_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_aggregate" ADD CONSTRAINT "pair_aggregate_player_2_id_player_id_fk" FOREIGN KEY ("player_2_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_import_change" ADD CONSTRAINT "pending_import_change_sync_run_id_sync_run_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_import_change" ADD CONSTRAINT "pending_import_change_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_import_change" ADD CONSTRAINT "pending_import_change_reviewed_by_admin_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_external_identity" ADD CONSTRAINT "player_external_identity_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ranking" ADD CONSTRAINT "player_ranking_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ranking" ADD CONSTRAINT "player_ranking_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stat_snapshot" ADD CONSTRAINT "player_stat_snapshot_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_change_log" ADD CONSTRAINT "pool_change_log_actor_admin_user_id_admin_user_id_fk" FOREIGN KEY ("actor_admin_user_id") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_change_log" ADD CONSTRAINT "pool_change_log_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_player_entry" ADD CONSTRAINT "pool_player_entry_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_player_entry" ADD CONSTRAINT "pool_player_entry_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_player_entry" ADD CONSTRAINT "pool_player_entry_source_team_entry_id_pool_team_entry_id_fk" FOREIGN KEY ("source_team_entry_id") REFERENCES "public"."pool_team_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_player_entry" ADD CONSTRAINT "pool_player_entry_approved_by_admin_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_team_entry" ADD CONSTRAINT "pool_team_entry_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_team_entry" ADD CONSTRAINT "pool_team_entry_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_team_entry" ADD CONSTRAINT "pool_team_entry_approved_by_admin_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_event" ADD CONSTRAINT "product_event_visitor_id_anonymous_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."anonymous_visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_event" ADD CONSTRAINT "product_event_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_source_snapshot" ADD CONSTRAINT "ranking_source_snapshot_approved_by_admin_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_membership" ADD CONSTRAINT "roster_membership_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_membership" ADD CONSTRAINT "roster_membership_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_external_identity" ADD CONSTRAINT "team_external_identity_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_daily_usage" ADD CONSTRAINT "visitor_daily_usage_visitor_id_anonymous_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."anonymous_visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_daily_usage" ADD CONSTRAINT "visitor_daily_usage_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_ballot_id_ballot_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_visitor_id_anonymous_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."anonymous_visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_winner_player_id_player_id_fk" FOREIGN KEY ("winner_player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_loser_player_id_player_id_fk" FOREIGN KEY ("loser_player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_revoked_by_admin_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."admin_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_actor_created_idx" ON "admin_audit_log" USING btree ("actor_admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_target_created_idx" ON "admin_audit_log" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_session_user_expires_idx" ON "admin_session" USING btree ("admin_user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ballot_one_open_per_visitor_edition" ON "ballot" USING btree ("visitor_id","edition_id") WHERE "ballot"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "ballot_edition_issued_idx" ON "ballot" USING btree ("edition_id","issued_at");--> statement-breakpoint
CREATE INDEX "ballot_pair_history_idx" ON "ballot" USING btree ("edition_id","player_1_id","player_2_id","issued_at");--> statement-breakpoint
CREATE INDEX "daily_ranking_snapshot_rank_idx" ON "daily_ranking_snapshot" USING btree ("edition_id","snapshot_date","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "edition_single_active" ON "edition" USING btree ((1)) WHERE "edition"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "event_team_result_team_idx" ON "event_team_result" USING btree ("team_id","event_id");--> statement-breakpoint
CREATE INDEX "event_dates_idx" ON "event" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "moderation_audit_vote_created_idx" ON "moderation_audit_log" USING btree ("vote_id","created_at");--> statement-breakpoint
CREATE INDEX "pending_import_status_created_idx" ON "pending_import_change" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "pending_import_sync_run_idx" ON "pending_import_change" USING btree ("sync_run_id","created_at");--> statement-breakpoint
CREATE INDEX "player_ranking_score_idx" ON "player_ranking" USING btree ("edition_id","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "player_stat_latest_idx" ON "player_stat_snapshot" USING btree ("player_id","provider","metric","period_type","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pool_change_log_edition_created_idx" ON "pool_change_log" USING btree ("edition_id","created_at");--> statement-breakpoint
CREATE INDEX "pool_player_active_pairing_idx" ON "pool_player_entry" USING btree ("edition_id","player_id") WHERE "pool_player_entry"."pairing_enabled" = true;--> statement-breakpoint
CREATE INDEX "pool_player_source_team_idx" ON "pool_player_entry" USING btree ("source_team_entry_id");--> statement-breakpoint
CREATE INDEX "pool_team_team_idx" ON "pool_team_entry" USING btree ("team_id","edition_id");--> statement-breakpoint
CREATE INDEX "product_event_occurred_idx" ON "product_event" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "product_event_edition_type_idx" ON "product_event" USING btree ("edition_id","event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "ranking_source_provider_captured_idx" ON "ranking_source_snapshot" USING btree ("provider","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "roster_team_current_idx" ON "roster_membership" USING btree ("team_id","ends_at","status");--> statement-breakpoint
CREATE INDEX "roster_player_history_idx" ON "roster_membership" USING btree ("player_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_one_current_per_player" ON "roster_membership" USING btree ("player_id") WHERE "roster_membership"."ends_at" is null;--> statement-breakpoint
CREATE INDEX "sync_run_job_started_idx" ON "sync_run" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "visitor_daily_usage_edition_date_idx" ON "visitor_daily_usage" USING btree ("edition_id","usage_date");--> statement-breakpoint
CREATE INDEX "vote_edition_created_idx" ON "vote" USING btree ("edition_id","created_at");--> statement-breakpoint
CREATE INDEX "vote_visitor_created_idx" ON "vote" USING btree ("visitor_id","created_at");