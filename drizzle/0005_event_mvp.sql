CREATE TABLE "event_mvp_candidate" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_mvp_candidate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contest_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"source_rank" integer NOT NULL,
	"event_rating" numeric NOT NULL,
	"maps" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_mvp_candidate_player_unique" UNIQUE("contest_id","player_id"),
	CONSTRAINT "event_mvp_candidate_rank_unique" UNIQUE("contest_id","source_rank"),
	CONSTRAINT "event_mvp_candidate_rank_positive" CHECK ("event_mvp_candidate"."source_rank" >= 1),
	CONSTRAINT "event_mvp_candidate_maps_nonnegative" CHECK ("event_mvp_candidate"."maps" is null or "event_mvp_candidate"."maps" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_mvp_contest" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_mvp_contest_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"nav_label" text NOT NULL,
	"hltv_event_id" text NOT NULL,
	"source_url" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_mvp_contest_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_mvp_contest_slug_not_blank" CHECK (length(btrim("event_mvp_contest"."slug")) > 0),
	CONSTRAINT "event_mvp_contest_name_not_blank" CHECK (length(btrim("event_mvp_contest"."name")) > 0),
	CONSTRAINT "event_mvp_contest_nav_label_not_blank" CHECK (length(btrim("event_mvp_contest"."nav_label")) > 0),
	CONSTRAINT "event_mvp_contest_hltv_event_id" CHECK ("event_mvp_contest"."hltv_event_id" ~ '^[1-9][0-9]*$'),
	CONSTRAINT "event_mvp_contest_source_not_blank" CHECK (length(btrim("event_mvp_contest"."source_url")) > 0),
	CONSTRAINT "event_mvp_contest_status" CHECK ("event_mvp_contest"."status" in ('ACTIVE', 'FROZEN')),
	CONSTRAINT "event_mvp_contest_date_order" CHECK ("event_mvp_contest"."ends_at" >= "event_mvp_contest"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "event_mvp_vote" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_mvp_vote_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contest_id" bigint NOT NULL,
	"visitor_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"usage_date" date NOT NULL,
	"status" "vote_status" NOT NULL,
	"risk_reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ip_risk_key" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_mvp_vote_risk_reasons_array" CHECK (jsonb_typeof("event_mvp_vote"."risk_reason_codes") = 'array'),
	CONSTRAINT "event_mvp_vote_ip_risk_key_sha256" CHECK ("event_mvp_vote"."ip_risk_key" is null or octet_length("event_mvp_vote"."ip_risk_key") = 32),
	CONSTRAINT "event_mvp_vote_status_allowed" CHECK ("event_mvp_vote"."status" in ('VALID', 'SUSPICIOUS'))
);
--> statement-breakpoint
ALTER TABLE "event_mvp_candidate" ADD CONSTRAINT "event_mvp_candidate_contest_id_event_mvp_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."event_mvp_contest"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_mvp_candidate" ADD CONSTRAINT "event_mvp_candidate_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_mvp_vote" ADD CONSTRAINT "event_mvp_vote_contest_id_event_mvp_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."event_mvp_contest"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_mvp_vote" ADD CONSTRAINT "event_mvp_vote_visitor_id_anonymous_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."anonymous_visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_mvp_vote" ADD CONSTRAINT "event_mvp_vote_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_mvp_single_active" ON "event_mvp_contest" USING btree ("status") WHERE "event_mvp_contest"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "event_mvp_one_vote_per_visitor_day" ON "event_mvp_vote" USING btree ("contest_id","visitor_id","usage_date") WHERE "event_mvp_vote"."status" <> 'REVOKED';--> statement-breakpoint
CREATE INDEX "event_mvp_vote_contest_player_idx" ON "event_mvp_vote" USING btree ("contest_id","player_id","status");