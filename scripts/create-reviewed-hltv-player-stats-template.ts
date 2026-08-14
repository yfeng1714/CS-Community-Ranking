import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { loadCanonicalManifest } from "../src/domain/canonical/manifest.ts";
import { DomainError } from "../src/domain/error.ts";
import { createReviewedHltvPlayerStatsTemplate } from "../src/domain/external-data/reviewed-player-stats.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    captured: { type: "string" },
    end: { type: "string" },
    manifest: { type: "string" },
    output: { type: "string" },
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
const manifest = await loadCanonicalManifest(manifestFile);
const template = createReviewedHltvPlayerStatsTemplate(manifest, {
  capturedAt: args.captured,
  periodEnd: args.end,
  periodStart: args.start,
});

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(template, null, 2)}\n`, { flag: "wx" });
process.stdout.write(
  `${JSON.stringify({ mode: "CREATED_EMPTY_TEMPLATE", output: outputFile, players: template.records.length })}\n`,
);
