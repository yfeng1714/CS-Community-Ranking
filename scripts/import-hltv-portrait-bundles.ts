import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface AttributionManifest {
  assets: Array<{
    assetPath: string;
    license: string;
    notes: string | null;
    permission: string;
    sourceUrl: string | null;
  }>;
  version: 1;
}

interface BrowserCapture {
  capturedAt: string;
  portraits: Array<{
    alt: string;
    externalId: string;
    externalSlug: string;
    href: string;
    team: string;
    url: string;
  }>;
  sourcePage: string;
}

interface BundleManifest {
  assets: Array<{
    contentType: string | null;
    path: string;
    url: string;
  }>;
}

interface CanonicalManifest {
  review: {
    reviewedAt: string;
  };
  teams: Array<{
    name: string;
    players: Array<{
      hltvIdentity: {
        externalId: string;
        externalSlug: string;
      };
      nickname: string;
      photoPath: string | null;
      slug: string;
    }>;
  }>;
}

interface RegistryManifest {
  assets: Array<{
    assetPath: string;
    permission: string;
  }>;
  version: 1;
}

function requiredArgument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) throw new Error(`Missing ${prefix}<value>`);
  return value;
}

const root = process.cwd();
const captureFile = path.resolve(requiredArgument("capture"));
const bundleDirectories = requiredArgument("bundles")
  .split(",")
  .map((directory) => path.resolve(directory.trim()))
  .filter(Boolean);
if (bundleDirectories.length === 0) throw new Error("At least one bundle directory is required");

const canonicalFile = path.join(root, "data", "canonical", "2026-beta.json");
const registryFile = path.join(root, "assets", "registry.json");
const attributionFile = path.join(root, "assets", "attribution.json");
const [capture, canonical, registry, attribution, ...bundleManifests] = await Promise.all([
  readFile(captureFile, "utf8").then((value) => JSON.parse(value) as BrowserCapture),
  readFile(canonicalFile, "utf8").then((value) => JSON.parse(value) as CanonicalManifest),
  readFile(registryFile, "utf8").then((value) => JSON.parse(value) as RegistryManifest),
  readFile(attributionFile, "utf8").then((value) => JSON.parse(value) as AttributionManifest),
  ...bundleDirectories.map((directory) =>
    readFile(path.join(directory, "manifest.json"), "utf8").then(
      (value) => JSON.parse(value) as BundleManifest,
    ),
  ),
]);

if (capture.sourcePage !== "https://www.hltv.org/ranking/teams/2026/august/10") {
  throw new Error(`Unexpected capture source: ${capture.sourcePage}`);
}

for (const [index, manifest] of bundleManifests.entries()) {
  const bundleRoot = `${bundleDirectories[index]}${path.sep}`;
  for (const asset of manifest.assets) {
    if (!path.resolve(asset.path).startsWith(bundleRoot)) {
      throw new Error(`Bundle asset escapes its directory: ${asset.path}`);
    }
  }
}

const capturedById = new Map(capture.portraits.map((portrait) => [portrait.externalId, portrait]));
if (capturedById.size !== capture.portraits.length) throw new Error("Duplicate captured Player ID");

const bundledByUrl = new Map(
  bundleManifests.flatMap((manifest) =>
    manifest.assets.map((asset) => [asset.url, asset] as const),
  ),
);
if (
  bundledByUrl.size !==
  bundleManifests.reduce((count, manifest) => count + manifest.assets.length, 0)
) {
  throw new Error("Duplicate bundled portrait URL");
}

const imports = canonical.teams.flatMap((team) =>
  team.players.map((player) => {
    const captured = capturedById.get(player.hltvIdentity.externalId);
    if (!captured) throw new Error(`Missing browser capture for ${player.slug}`);
    if (captured.externalSlug !== player.hltvIdentity.externalSlug) {
      throw new Error(`HLTV slug mismatch for ${player.slug}`);
    }
    if (
      captured.href !==
      `/player/${player.hltvIdentity.externalId}/${player.hltvIdentity.externalSlug}`
    ) {
      throw new Error(`HLTV profile path mismatch for ${player.slug}`);
    }
    if (captured.team !== team.name) throw new Error(`Team mismatch for ${player.slug}`);
    if (!captured.alt.includes(`'${player.nickname}'`)) {
      throw new Error(`Nickname mismatch for ${player.slug}: ${captured.alt}`);
    }
    const source = new URL(captured.url);
    if (
      source.protocol !== "https:" ||
      source.hostname !== "img-cdn.hltv.org" ||
      !source.pathname.startsWith("/playerbodyshot/")
    ) {
      throw new Error(`Unexpected portrait source for ${player.slug}: ${captured.url}`);
    }
    const bundle = bundledByUrl.get(captured.url);
    if (!bundle) throw new Error(`Missing bundled image for ${player.slug}`);
    if (bundle.contentType !== "image/webp") {
      throw new Error(`Unexpected content type for ${player.slug}: ${bundle.contentType}`);
    }
    return {
      assetPath: `/images/players/${player.slug}.webp`,
      bundlePath: bundle.path,
      player,
      sourceUrl: captured.url,
    };
  }),
);

if (imports.length !== 70 || capturedById.size !== 70 || bundledByUrl.size !== 70) {
  throw new Error(
    `Expected exact 70/70/70 coverage; got ${imports.length}/${capturedById.size}/${bundledByUrl.size}`,
  );
}
await Promise.all(imports.map((entry) => access(entry.bundlePath)));

const playerPaths = new Set(imports.map((entry) => entry.assetPath));
registry.assets = [
  ...registry.assets.filter((entry) => !entry.assetPath.startsWith("/images/players/")),
  ...imports.map((entry) => ({
    assetPath: entry.assetPath,
    permission: "OWNER_ACCEPTED_PENDING_RIGHTS",
  })),
];
attribution.assets = [
  ...attribution.assets.filter((entry) => !entry.assetPath.startsWith("/images/players/")),
  ...imports.map((entry) => ({
    assetPath: entry.assetPath,
    license: "Rights not independently verified; HLTV-hosted player body shot",
    notes:
      "Captured after opening the canonical Team roster on the official August 10, 2026 HLTV ranking page; local community-beta copy.",
    permission: "OWNER_ACCEPTED_PENDING_RIGHTS",
    sourceUrl: entry.sourceUrl,
  })),
];
if (new Set(registry.assets.map((entry) => entry.assetPath)).size !== registry.assets.length) {
  throw new Error("Duplicate final registry path");
}
if (
  new Set(attribution.assets.map((entry) => entry.assetPath)).size !== attribution.assets.length
) {
  throw new Error("Duplicate final attribution path");
}
if (
  ![...playerPaths].every((assetPath) =>
    attribution.assets.some((entry) => entry.assetPath === assetPath),
  )
) {
  throw new Error("Incomplete final Player attribution coverage");
}

await mkdir(path.join(root, "public", "images", "players"), { recursive: true });
await Promise.all(
  imports.map(async (entry) => {
    await copyFile(entry.bundlePath, path.join(root, "public", entry.assetPath.replace(/^\//, "")));
    entry.player.photoPath = entry.assetPath;
  }),
);
canonical.review.reviewedAt = capture.capturedAt;
await Promise.all([
  writeFile(canonicalFile, `${JSON.stringify(canonical, null, 2)}\n`),
  writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`),
  writeFile(attributionFile, `${JSON.stringify(attribution, null, 2)}\n`),
]);

process.stdout.write(
  `Imported ${imports.length} identity-verified HLTV portraits from ${bundleDirectories.length} bundles.\n`,
);
