ALTER TABLE "ballot" ADD CONSTRAINT "ballot_ip_risk_key_sha256" CHECK ("ballot"."issued_ip_risk_key" is null or octet_length("ballot"."issued_ip_risk_key") = 32);--> statement-breakpoint
ALTER TABLE "risk_observation" ADD CONSTRAINT "risk_observation_ip_risk_key_sha256" CHECK ("risk_observation"."ip_risk_key" is null or octet_length("risk_observation"."ip_risk_key") = 32);--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_ip_risk_key_sha256" CHECK ("vote"."ip_risk_key" is null or octet_length("vote"."ip_risk_key") = 32);
