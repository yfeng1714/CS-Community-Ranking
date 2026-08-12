CREATE TABLE "api_request_metric" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_request_metric_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"visitor_id" bigint,
	"route" text NOT NULL,
	"status_code" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"error_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_request_metric_route_safe" CHECK ("api_request_metric"."route" ~ '^/[a-z0-9_/{}/-]{1,127}$'),
	CONSTRAINT "api_request_metric_status_range" CHECK ("api_request_metric"."status_code" >= 100 and "api_request_metric"."status_code" <= 599),
	CONSTRAINT "api_request_metric_latency_nonnegative" CHECK ("api_request_metric"."latency_ms" >= 0),
	CONSTRAINT "api_request_metric_error_code_safe" CHECK ("api_request_metric"."error_code" is null or "api_request_metric"."error_code" ~ '^[A-Z0-9_]{1,64}$')
);
--> statement-breakpoint
CREATE TABLE "risk_observation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "risk_observation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"visitor_id" bigint,
	"ip_risk_key" "bytea",
	"reason_code" text NOT NULL,
	"route" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_observation_reason_code_safe" CHECK ("risk_observation"."reason_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "risk_observation_route_safe" CHECK ("risk_observation"."route" ~ '^/[a-z0-9_/{}/-]{1,127}$'),
	CONSTRAINT "risk_observation_has_pseudonymous_subject" CHECK ("risk_observation"."visitor_id" is not null or "risk_observation"."ip_risk_key" is not null)
);
--> statement-breakpoint
ALTER TABLE "ballot" ADD COLUMN "risk_reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "api_request_metric" ADD CONSTRAINT "api_request_metric_visitor_id_anonymous_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."anonymous_visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_observation" ADD CONSTRAINT "risk_observation_visitor_id_anonymous_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."anonymous_visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_request_metric_route_occurred_idx" ON "api_request_metric" USING btree ("route","occurred_at");--> statement-breakpoint
CREATE INDEX "risk_observation_ip_occurred_idx" ON "risk_observation" USING btree ("ip_risk_key","occurred_at");--> statement-breakpoint
CREATE INDEX "risk_observation_visitor_occurred_idx" ON "risk_observation" USING btree ("visitor_id","occurred_at");--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_risk_reasons_array" CHECK (jsonb_typeof("ballot"."risk_reason_codes") = 'array');
