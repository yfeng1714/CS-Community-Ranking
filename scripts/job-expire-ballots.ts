import { parseArgs } from "node:util";

import { expireOpenBallots } from "../src/domain/maintenance/jobs.ts";
import { cliArgs } from "./cli-args.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const batch = parseArgs({ args: cliArgs(), options: { batch: { type: "string" } }, strict: true })
  .values.batch;
const batchSize = batch ? Number(batch) : 500;
if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 10_000) {
  throw new Error("--batch must be an integer from 1 to 10000");
}
const { database, pool } = createJobContext("cs-community-ranking-job-expire-ballots");
try {
  printJobResult(await expireOpenBallots(database, { batchSize }));
} finally {
  await pool.end();
}
