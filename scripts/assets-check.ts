import { access, open, readdir } from "node:fs/promises";
import path from "node:path";

import { loadAssetRegistry, loadAttributionManifest } from "../src/domain/assets/attribution.ts";

async function assertImageMagicBytes(absolutePath: string, assetPath: string) {
  const handle = await open(absolutePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    if (assetPath.endsWith(".webp")) {
      const riff = header.subarray(0, 4).toString("ascii") === "RIFF";
      const webp = header.subarray(8, 12).toString("ascii") === "WEBP";
      if (bytesRead < 12 || !riff || !webp) {
        throw new Error(
          `${assetPath} must contain real WebP bytes; a JPEG/PNG renamed .webp fails under nosniff`,
        );
      }
    }
  } finally {
    await handle.close();
  }
}

const [registry, attribution] = await Promise.all([loadAssetRegistry(), loadAttributionManifest()]);
const registered = new Map<string, string>();
for (const entry of registry.assets) {
  if (registered.has(entry.assetPath))
    throw new Error(`Duplicate registry path: ${entry.assetPath}`);
  registered.set(entry.assetPath, entry.permission);
  const absolutePath = path.join(process.cwd(), "public", entry.assetPath.replace(/^\//, ""));
  await access(absolutePath);
  await assertImageMagicBytes(absolutePath, entry.assetPath);
}
const sourced = new Set<string>();
for (const entry of attribution.assets) {
  if (sourced.has(entry.assetPath)) throw new Error(`Duplicate attribution: ${entry.assetPath}`);
  sourced.add(entry.assetPath);
  const permission = registered.get(entry.assetPath);
  if (!permission) throw new Error(`Unregistered attribution: ${entry.assetPath}`);
  if (permission !== entry.permission) {
    throw new Error(`Permission mismatch for ${entry.assetPath}`);
  }
}
for (const kind of ["players", "teams"] as const) {
  const directory = path.join(process.cwd(), "public", "images", kind);
  for (const file of await readdir(directory)) {
    if (file.startsWith(".")) continue;
    const assetPath = `/images/${kind}/${file}`;
    if (!registered.has(assetPath)) throw new Error(`Missing registry entry: ${assetPath}`);
    if (!sourced.has(assetPath)) throw new Error(`Missing local attribution: ${assetPath}`);
  }
}
if (registered.size !== sourced.size) {
  throw new Error("Tracked registry and local attribution paths do not match");
}
process.stdout.write(
  `Validated ${registry.assets.length} local assets against the tracked registry and ignored source records.\n`,
);
