import { parseArgs } from "node:util";

import { DomainError } from "../src/domain/error.ts";
import { snapshotDailyRanking } from "../src/domain/external-data/daily-ranking.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const args = parseArgs({
  options: { date: { type: "string" }, edition: { type: "string" } },
  strict: true,
}).values;
if (!args.edition) throw new DomainError("CLI_OPTION_REQUIRED", "--edition is required");
const date = args.date ?? new Date().toISOString().slice(0, 10);
const { database, pool } = createJobContext("cs-community-ranking-job-snapshot-ranking");
try {
  printJobResult(
    await snapshotDailyRanking(database, { editionCode: args.edition, snapshotDate: date }),
  );
} finally {
  await pool.end();
}
