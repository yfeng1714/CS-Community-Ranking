import { parseArgs } from "node:util";

import { DomainError } from "../src/domain/error.ts";
import { runIntegrityCheck } from "../src/domain/integrity/check.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const edition = parseArgs({ options: { edition: { type: "string" } }, strict: true }).values
  .edition;
if (!edition) throw new DomainError("CLI_OPTION_REQUIRED", "--edition is required");
const { database, pool } = createJobContext("cs-community-ranking-job-integrity-check");
try {
  const result = await runIntegrityCheck(database, { editionCode: edition });
  printJobResult(result);
  if (!result.healthy) process.exitCode = 1;
} finally {
  await pool.end();
}
