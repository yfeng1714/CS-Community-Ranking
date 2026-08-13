import { parseArgs } from "node:util";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { seedDevelopmentData } from "../src/db/seed.ts";
import * as schema from "../src/db/schema/index.ts";
import { cliArgs } from "./cli-args.ts";
import { assertStagingBootstrapAllowed } from "./staging-bootstrap-support.ts";

const args = parseArgs({
  args: cliArgs(),
  options: { "confirm-staging": { type: "boolean" } },
  strict: true,
}).values;

assertStagingBootstrapAllowed(args["confirm-staging"] === true, process.env);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  application_name: "cs-community-ranking-staging-bootstrap",
  connectionString: databaseUrl,
  max: 1,
});

try {
  const existing = await pool.query<{
    active_admins: string;
    editions: string;
    players: string;
    teams: string;
    votes: string;
  }>(`
    select
      (select count(*) from admin_user where active = true)::text as active_admins,
      (select count(*) from edition)::text as editions,
      (select count(*) from player)::text as players,
      (select count(*) from team)::text as teams,
      (select count(*) from vote)::text as votes
  `);
  const counts = existing.rows[0];
  if (!counts || Object.values(counts).some((count) => count !== "0")) {
    throw new Error(
      `Staging bootstrap requires an empty product database; found ${JSON.stringify(counts)}`,
    );
  }

  await seedDevelopmentData(drizzle(pool, { schema }));
  process.stdout.write(
    `${JSON.stringify({ edition: "2026", fictionalPlayers: 4, fictionalTeams: 2, status: "bootstrapped" })}\n`,
  );
} finally {
  await pool.end();
}
