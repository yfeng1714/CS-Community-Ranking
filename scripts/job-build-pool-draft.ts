import { parseArgs } from "node:util";

import { getEnv } from "../src/config/env.ts";
import { DomainError } from "../src/domain/error.ts";
import { buildCandidatePoolDraft } from "../src/domain/external-data/pool-draft.ts";
import { cliArgs } from "./cli-args.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const edition = parseArgs({
  args: cliArgs(),
  options: { edition: { type: "string" } },
  strict: true,
}).values.edition;
if (!edition) throw new DomainError("CLI_OPTION_REQUIRED", "--edition is required");
const env = getEnv();
const { database, pool } = createJobContext("cs-community-ranking-job-build-pool-draft");
try {
  printJobResult(
    await buildCandidatePoolDraft(database, {
      editionCode: edition,
      maxSourceAgeDays: env.EXTERNAL_SOURCE_MAX_AGE_DAYS,
    }),
  );
} finally {
  await pool.end();
}
