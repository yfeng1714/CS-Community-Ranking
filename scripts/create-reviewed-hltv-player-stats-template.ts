import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { loadCanonicalManifest } from "../src/domain/canonical/manifest.ts";
import { DomainError } from "../src/domain/error.ts";
import { createReviewedHltvPlayerStatsTemplate } from "../src/domain/external-data/reviewed-player-stats.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    captured: { type: "string" },
    end: { type: "string" },
    manifest: { type: "string" },
    output: { type: "string" },
    "review-manual": { type: "string" },
    start: { type: "string" },
  },
  strict: true,
}).values;

if (!args.captured || !args.end || !args.start) {
  throw new DomainError(
    "CLI_OPTION_REQUIRED",
    "--captured, --start, and --end are required for a reviewed stats template",
  );
}

const manifestFile = path.resolve(args.manifest ?? "data/canonical/2026-beta.json");
const outputFile = path.resolve(
  args.output ?? "data/reviewed-sources/hltv-player-stats-local.json",
);
const canonical = await loadCanonicalManifest(manifestFile);
const reviewManual = args["review-manual"]
  ? await loadReviewManualManifest(path.resolve(args["review-manual"]))
  : null;
const template = createReviewedHltvPlayerStatsTemplate(
  {
    teams: [...canonical.teams, ...(reviewManual?.teams ?? [])],
  },
  {
    capturedAt: args.captured,
    periodEnd: args.end,
    periodStart: args.start,
  },
);

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(template, null, 2)}\n`, { flag: "wx" });
process.stdout.write(
  `${JSON.stringify({ mode: "CREATED_EMPTY_TEMPLATE", output: outputFile, players: template.records.length })}\n`,
);
