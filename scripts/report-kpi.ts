import { parseArgs } from "node:util";

import { getEnv } from "../src/config/env.ts";
import { generateDailyKpiReport } from "../src/domain/analytics/kpi.ts";
import { dateInTimeZone } from "../src/domain/ballots/date.ts";
import { DomainError } from "../src/domain/error.ts";
import { requireIsoDate } from "../src/domain/date.ts";
import { cliArgs } from "./cli-args.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const args = parseArgs({
  args: cliArgs(),
  options: { date: { type: "string" }, edition: { type: "string" } },
  strict: true,
}).values;
if (!args.edition) throw new DomainError("CLI_OPTION_REQUIRED", "--edition is required");
const env = getEnv();
const date = args.date
  ? requireIsoDate(args.date, "--date")
  : dateInTimeZone(new Date(), env.APP_TIME_ZONE);
const { database, pool } = createJobContext("cs-community-ranking-report-kpi");
try {
  printJobResult(
    await generateDailyKpiReport(database, {
      date,
      editionCode: args.edition,
      timeZone: env.APP_TIME_ZONE,
    }),
  );
} finally {
  await pool.end();
}
