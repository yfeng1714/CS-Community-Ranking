import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { printCliError } from "./pool-cli-support.ts";

import {
  listHltvTeamLogoTargets,
  loadHltvTeamLogoBundle,
  logoAssetPath,
  sha256Hex,
  validateHltvTeamLogoBundle,
} from "../src/domain/assets/hltv-team-logos.ts";
import { DomainError } from "../src/domain/error.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import { cliArgs } from "./cli-args.ts";

const LOGO_NOTE =
  "Team logos and player portraits are local HLTV copies accepted as pending-rights community-beta assets.";

const args = parseArgs({
  args: cliArgs(),
  options: {
    apply: { type: "boolean" },
    "confirm-team-logos": { type: "boolean" },
    file: { type: "string" },
    "review-manual": { type: "string" },
  },
  strict: true,
}).values;

try {
  const root = process.cwd();
  const bundleFile = path.resolve(args.file ?? "data/reviewed-sources/hltv-team-logos-local.json");
  const bundleDirectory = path.join(path.dirname(bundleFile), "hltv-team-logos");
  const reviewManualFile = path.resolve(
    args["review-manual"] ?? "data/review-manual/2026-08-17.json",
  );
  const registryFile = path.join(root, "assets", "registry.json");
  const attributionFile = path.join(root, "assets", "attribution.json");

  const reviewManual = await loadReviewManualManifest(reviewManualFile);
  const targets = listHltvTeamLogoTargets(reviewManual);
  const bundle = validateHltvTeamLogoBundle(await loadHltvTeamLogoBundle(bundleFile), targets);

  const copies = [];
  for (const record of bundle.records) {
    const source = path.join(bundleDirectory, record.file);
    const bytes = await readFile(source);
    if (sha256Hex(bytes) !== record.sha256) {
      throw new DomainError(
        "HLTV_TEAM_LOGO_CHECKSUM_MISMATCH",
        `Checksum mismatch for ${record.slug}`,
      );
    }
    const extension = record.file.endsWith(".png") ? "png" : "webp";
    if (extension === "webp") {
      if (
        bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
        bytes.subarray(8, 12).toString("ascii") !== "WEBP"
      ) {
        throw new DomainError(
          "HLTV_TEAM_LOGO_NOT_WEBP",
          `${record.file} must contain real WebP bytes`,
        );
      }
    } else if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new DomainError("HLTV_TEAM_LOGO_NOT_PNG", `${record.file} must contain real PNG bytes`);
    }
    copies.push({
      assetPath: logoAssetPath(record.slug, extension),
      record,
      source,
    });
  }

  const summary = {
    capturedAt: bundle.capturedAt,
    mode: args.apply ? "APPLIED" : "DRY_RUN",
    teams: copies.map((entry) => entry.record.slug),
  };

  if (!args.apply) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } else {
    if (args["confirm-team-logos"] !== true) {
      throw new DomainError(
        "HLTV_TEAM_LOGO_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-team-logos",
      );
    }
    const registry = JSON.parse(await readFile(registryFile, "utf8")) as {
      assets: Array<{ assetPath: string; permission: string }>;
      version: 1;
    };
    const attribution = JSON.parse(await readFile(attributionFile, "utf8")) as {
      assets: Array<{
        assetPath: string;
        license: string;
        notes: string | null;
        permission: string;
        sourceUrl: string | null;
      }>;
      version: 1;
    };
    const importedPaths = new Set(copies.map((entry) => entry.assetPath));
    registry.assets = [
      ...registry.assets.filter((entry) => !importedPaths.has(entry.assetPath)),
      ...copies.map((entry) => ({
        assetPath: entry.assetPath,
        permission: "OWNER_ACCEPTED_PENDING_RIGHTS",
      })),
    ];
    attribution.assets = [
      ...attribution.assets.filter((entry) => !importedPaths.has(entry.assetPath)),
      ...copies.map((entry) => ({
        assetPath: entry.assetPath,
        license: "Rights not independently verified; HLTV-hosted team logo",
        notes: `Captured from the official HLTV team page (${entry.record.variant} variant); local community-beta copy. Dark UI container, no baked background.`,
        permission: "OWNER_ACCEPTED_PENDING_RIGHTS",
        sourceUrl: entry.record.sourceUrl,
      })),
    ];
    await mkdir(path.join(root, "public", "images", "teams"), { recursive: true });
    await Promise.all(
      copies.map((entry) =>
        copyFile(entry.source, path.join(root, "public", entry.assetPath.replace(/^\//, ""))),
      ),
    );
    const logoBySlug = new Map(copies.map((entry) => [entry.record.slug, entry.assetPath]));
    for (const team of reviewManual.teams) {
      const logoPath = logoBySlug.get(team.slug);
      if (logoPath) team.logoPath = logoPath;
    }
    reviewManual.notes = reviewManual.notes.map((note) =>
      note.startsWith("Team logos remain omitted") ||
      note.startsWith("Logos and portraits are omitted")
        ? LOGO_NOTE
        : note,
    );
    await Promise.all([
      writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`),
      writeFile(attributionFile, `${JSON.stringify(attribution, null, 2)}\n`),
      writeFile(reviewManualFile, `${JSON.stringify(reviewManual, null, 2)}\n`),
    ]);
    process.stdout.write(`${JSON.stringify({ ...summary, imported: copies.length })}\n`);
  }
} catch (error) {
  printCliError(error);
}
