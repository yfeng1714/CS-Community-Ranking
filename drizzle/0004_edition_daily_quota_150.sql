ALTER TABLE "edition" ALTER COLUMN "full_weight_ballots_per_day" SET DEFAULT 150;--> statement-breakpoint
UPDATE "edition" SET "full_weight_ballots_per_day" = 150, "updated_at" = now() WHERE "full_weight_ballots_per_day" = 50;
