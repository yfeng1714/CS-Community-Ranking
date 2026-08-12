import { getEnv } from "../src/config/env.ts";
import { runRetentionCleanup } from "../src/domain/maintenance/jobs.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const env = getEnv();
const { database, pool } = createJobContext("cs-community-ranking-job-retention-cleanup");
try {
  printJobResult(
    await runRetentionCleanup(database, {
      ipRiskKeyRetentionDays: env.IP_RISK_KEY_RETENTION_DAYS,
      productEventRetentionDays: env.PRODUCT_EVENT_RETENTION_DAYS,
    }),
  );
} finally {
  await pool.end();
}
