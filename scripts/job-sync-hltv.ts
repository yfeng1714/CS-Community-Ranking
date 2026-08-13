import { parseArgs } from "node:util";

import { getEnv } from "../src/config/env.ts";
import { DomainError } from "../src/domain/error.ts";
import { syncHltvPlayerStats, syncHltvRanking } from "../src/domain/external-data/jobs.ts";
import { cliArgs } from "./cli-args.ts";
import { createJobContext, printJobResult } from "./job-support.ts";

const env = getEnv();
if (!env.HLTV_SYNC_ENABLED || !env.HLTV_USER_AGENT)
  throw new DomainError(
    "HLTV_SYNC_DISABLED",
    "Enable HLTV sync and configure HLTV_USER_AGENT first",
  );
const args = parseArgs({
  args: cliArgs(),
  options: {
    end: { type: "string" },
    published: { type: "string" },
    rankingUrl: { type: "string" },
    start: { type: "string" },
  },
  strict: true,
}).values;
const { database, pool } = createJobContext("cs-community-ranking-job-sync-hltv");
try {
  const results: unknown[] = [];
  if (args.rankingUrl && args.published)
    results.push(
      await syncHltvRanking(database, {
        delayMs: env.HLTV_REQUEST_DELAY_MS,
        publishedAt: new Date(args.published),
        sourceUrl: args.rankingUrl,
        userAgent: env.HLTV_USER_AGENT,
      }),
    );
  if (args.start && args.end)
    results.push(
      await syncHltvPlayerStats(database, {
        delayMs: env.HLTV_REQUEST_DELAY_MS,
        periodEnd: args.end,
        periodStart: args.start,
        userAgent: env.HLTV_USER_AGENT,
      }),
    );
  if (results.length === 0)
    throw new DomainError(
      "HLTV_JOB_OPTIONS_REQUIRED",
      "Provide --rankingUrl and --published, or --start and --end",
    );
  printJobResult(results);
} finally {
  await pool.end();
}
