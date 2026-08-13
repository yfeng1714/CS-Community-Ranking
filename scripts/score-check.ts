import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema/index.ts";
import { DomainError, requireDomainValue } from "../src/domain/error.ts";
import { checkScoreIntegrity } from "../src/domain/votes/integrity.ts";
import { cliArgs } from "./cli-args.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new DomainError("DATABASE_URL_REQUIRED", "DATABASE_URL is required");
}

const editionCode = parseArgs({
  args: cliArgs(),
  options: { edition: { type: "string" } },
  strict: true,
}).values.edition?.trim();
if (!editionCode) {
  throw new DomainError("CLI_OPTION_REQUIRED", "--edition is required");
}

const pool = new Pool({
  application_name: "cs-community-ranking-score-check",
  connectionString: databaseUrl,
  max: 2,
});
const database = drizzle(pool, { schema });

try {
  const [edition] = await database
    .select({ id: schema.editions.id })
    .from(schema.editions)
    .where(eq(schema.editions.code, editionCode))
    .limit(1);
  const report = await checkScoreIntegrity(
    database,
    requireDomainValue(edition, "EDITION_NOT_FOUND", `Edition ${editionCode} does not exist`).id,
  );
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.healthy) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
