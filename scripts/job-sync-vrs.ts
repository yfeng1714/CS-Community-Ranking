import { getEnv } from "../src/config/env.ts";
import { DomainError } from "../src/domain/error.ts";
import { syncValveVrs } from "../src/domain/external-data/jobs.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const env = getEnv();
if (!env.VRS_SOURCE_URL)
  throw new DomainError("VRS_SOURCE_URL_REQUIRED", "VRS_SOURCE_URL is required");
const { database, pool } = createJobContext("cs-community-ranking-job-sync-vrs");
try {
  printJobResult(await syncValveVrs(database, { sourceUrl: env.VRS_SOURCE_URL }));
} finally {
  await pool.end();
}
