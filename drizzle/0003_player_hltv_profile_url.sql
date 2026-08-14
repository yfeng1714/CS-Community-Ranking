ALTER TABLE "player" ADD COLUMN "hltv_profile_url" text;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_hltv_profile_url_valid" CHECK ("player"."hltv_profile_url" is null or "player"."hltv_profile_url" ~ '^https://(www\.)?hltv\.org/player/[1-9][0-9]*/[^/?#]+/?$');
