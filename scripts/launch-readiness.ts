import { parseArgs } from "node:util";

import { getEnv } from "../src/config/env.ts";
import { DomainError } from "../src/domain/error.ts";
import { checkLaunchReadiness } from "../src/domain/launch/readiness.ts";
import { cliArgs } from "./cli-args.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const edition = parseArgs({
  args: cliArgs(),
  options: { edition: { type: "string" } },
  strict: true,
}).values.edition;
if (!edition) throw new DomainError("CLI_OPTION_REQUIRED", "--edition is required");

const env = getEnv();
const { database, pool } = createJobContext("cs-community-ranking-launch-readiness");
try {
  const report = await checkLaunchReadiness(database, {
    editionCode: edition,
    expectedRiskMode: env.RISK_ENFORCEMENT_MODE,
    sourceMaxAgeDays: env.EXTERNAL_SOURCE_MAX_AGE_DAYS,
  });
  printJobResult(report);
  if (report.blocking) process.exitCode = 1;
} finally {
  await pool.end();
}
