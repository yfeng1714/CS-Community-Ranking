import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { printCliError } from "./pool-cli-support.ts";

import {
  listHltvProfilePortraitTargets,
  loadHltvProfilePortraitBundle,
  portraitAssetPath,
  sha256Hex,
  validateHltvProfilePortraitBundle,
  type HltvProfilePortraitSource,
} from "../src/domain/assets/hltv-profile-portraits.ts";
import { DomainError } from "../src/domain/error.ts";
import { loadCanonicalManifest } from "../src/domain/canonical/manifest.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import { loadSpecialRetiredManifest } from "../src/domain/pool/special-retired-manifest.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    apply: { type: "boolean" },
    canonical: { type: "string" },
    "confirm-profile-portraits": { type: "boolean" },
    file: { type: "string" },
    "review-manual": { type: "string" },
    source: { type: "string" },
    "special-retired": { type: "string" },
  },
  strict: true,
}).values;

try {
  const sourceFilter = parseSourceOption(args.source);
  const root = process.cwd();
  const bundleFile = path.resolve(
    args.file ??
      (sourceFilter === "CORE"
        ? "data/reviewed-sources/hltv-profile-portraits-core-local.json"
        : "data/reviewed-sources/hltv-profile-portraits-local.json"),
  );
  const bundleDirectory = path.join(
    path.dirname(bundleFile),
    sourceFilter === "CORE" ? "hltv-profile-portraits-core" : "hltv-profile-portraits",
  );
  const canonicalFile = path.resolve(args.canonical ?? "data/canonical/2026-beta.json");
  const reviewManualFile = path.resolve(
    args["review-manual"] ?? "data/review-manual/2026-08-17.json",
  );
  const specialRetiredFile = path.resolve(
    args["special-retired"] ?? "data/review-manual/special-retired-2026-08-17.json",
  );
  const registryFile = path.join(root, "assets", "registry.json");
  const attributionFile = path.join(root, "assets", "attribution.json");

  const canonical = await loadCanonicalManifest(canonicalFile);
  const reviewManual = await loadReviewManualManifest(reviewManualFile);
  const specialRetired = await loadSpecialRetiredManifest(specialRetiredFile);
  const targets = listHltvProfilePortraitTargets({
    canonical,
    reviewManual,
    source: sourceFilter,
    specialRetired,
  });
  const bundle = validateHltvProfilePortraitBundle(
    await loadHltvProfilePortraitBundle(bundleFile),
    targets,
  );

  const copies = [];
  for (const record of bundle.records) {
    const source = path.join(bundleDirectory, record.file);
    const bytes = await readFile(source);
    if (sha256Hex(bytes) !== record.sha256) {
      throw new DomainError(
        "HLTV_PROFILE_PORTRAIT_CHECKSUM_MISMATCH",
        `Checksum mismatch for ${record.slug}`,
      );
    }
    if (
      bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
      bytes.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      throw new DomainError(
        "HLTV_PROFILE_PORTRAIT_NOT_WEBP",
        `${record.file} must contain real WebP bytes`,
      );
    }
    copies.push({
      assetPath: portraitAssetPath(record.slug),
      record,
      source,
    });
  }

  const summary = {
    capturedAt: bundle.capturedAt,
    mode: args.apply ? "APPLIED" : "DRY_RUN",
    players: copies.map((entry) => entry.record.slug),
  };

  if (!args.apply) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } else {
    if (args["confirm-profile-portraits"] !== true) {
      throw new DomainError(
        "HLTV_PROFILE_PORTRAIT_CONFIRMATION_REQUIRED",
        "--apply also requires --confirm-profile-portraits",
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
    const imported = new Map(
      copies.map((entry) => [
        entry.assetPath,
        {
          assetPath: entry.assetPath,
          license: "Rights not independently verified; HLTV-hosted player body shot",
          notes:
            "Captured from the official HLTV player profile body shot (data-cookieblock-src / playerbodyshot); local community-beta copy converted to WebP.",
          permission: "OWNER_ACCEPTED_PENDING_RIGHTS" as const,
          sourceUrl: entry.record.sourceUrl,
        },
      ]),
    );
    registry.assets = [
      ...registry.assets.map((entry) => {
        const next = imported.get(entry.assetPath);
        return next ? { assetPath: next.assetPath, permission: next.permission } : entry;
      }),
      ...[...imported.values()]
        .filter(
          (entry) => !registry.assets.some((existing) => existing.assetPath === entry.assetPath),
        )
        .map((entry) => ({ assetPath: entry.assetPath, permission: entry.permission })),
    ];
    attribution.assets = [
      ...attribution.assets.map((entry) => imported.get(entry.assetPath) ?? entry),
      ...[...imported.values()].filter(
        (entry) => !attribution.assets.some((existing) => existing.assetPath === entry.assetPath),
      ),
    ];
    await mkdir(path.join(root, "public", "images", "players"), { recursive: true });
    await Promise.all(
      copies.map((entry) =>
        copyFile(entry.source, path.join(root, "public", entry.assetPath.replace(/^\//, ""))),
      ),
    );
    const photoBySlug = new Map(copies.map((entry) => [entry.record.slug, entry.assetPath]));
    let canonicalDirty = false;
    for (const team of canonical.teams) {
      for (const player of team.players) {
        const photoPath = photoBySlug.get(player.slug);
        if (photoPath && player.photoPath !== photoPath) {
          player.photoPath = photoPath;
          canonicalDirty = true;
        }
      }
    }
    for (const team of reviewManual.teams) {
      for (const player of team.players) {
        const photoPath = photoBySlug.get(player.slug);
        if (photoPath) player.photoPath = photoPath;
      }
    }
    reviewManual.notes = reviewManual.notes.map((note) =>
      note.startsWith("Logos and portraits are omitted") ||
      note.startsWith("Team logos remain omitted")
        ? "Team logos and player portraits are local HLTV copies accepted as pending-rights community-beta assets."
        : note,
    );
    for (const player of specialRetired.players) {
      const photoPath = photoBySlug.get(player.slug);
      if (photoPath) player.photoPath = photoPath;
    }
    const writes: Array<Promise<void>> = [
      writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`),
      writeFile(attributionFile, `${JSON.stringify(attribution, null, 2)}\n`),
    ];
    if (canonicalDirty) {
      writes.push(writeFile(canonicalFile, `${JSON.stringify(canonical, null, 2)}\n`));
    }
    if (sourceFilter === undefined || sourceFilter === "REVIEW_MANUAL") {
      writes.push(writeFile(reviewManualFile, `${JSON.stringify(reviewManual, null, 2)}\n`));
    }
    if (sourceFilter === undefined || sourceFilter === "SPECIAL_RETIRED") {
      writes.push(writeFile(specialRetiredFile, `${JSON.stringify(specialRetired, null, 2)}\n`));
    }
    await Promise.all(writes);
    process.stdout.write(`${JSON.stringify({ ...summary, imported: copies.length })}\n`);
  }
} catch (error) {
  printCliError(error);
}

function parseSourceOption(value: string | undefined): HltvProfilePortraitSource | undefined {
  if (value === undefined) return undefined;
  if (value === "CORE" || value === "REVIEW_MANUAL" || value === "SPECIAL_RETIRED") return value;
  throw new DomainError(
    "CLI_OPTION_INVALID",
    "--source must be CORE, REVIEW_MANUAL, or SPECIAL_RETIRED",
  );
}
