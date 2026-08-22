ALTER TABLE "event_mvp_candidate" ADD COLUMN "team_standing" text;--> statement-breakpoint
ALTER TABLE "event_mvp_candidate" ADD CONSTRAINT "event_mvp_candidate_standing" CHECK ("event_mvp_candidate"."team_standing" is null or "event_mvp_candidate"."team_standing" in ('CHAMPION', 'RUNNER_UP', 'THIRD', 'FOURTH', 'SEMIFINAL', 'QUARTERFINAL', 'ROUND_OF_16', 'GROUP'));
