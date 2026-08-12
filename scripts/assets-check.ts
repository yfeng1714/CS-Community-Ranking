import { access, readdir } from "node:fs/promises";
import path from "node:path";

import { loadAttributionManifest } from "../src/domain/assets/attribution.ts";

const manifest = await loadAttributionManifest();
const seen = new Set<string>();
for (const entry of manifest.assets) {
  if (seen.has(entry.assetPath)) throw new Error(`Duplicate attribution: ${entry.assetPath}`);
  seen.add(entry.assetPath);
  await access(path.join(process.cwd(), "public", entry.assetPath.replace(/^\//, "")));
}
for (const kind of ["players", "teams"] as const) {
  const directory = path.join(process.cwd(), "public", "images", kind);
  for (const file of await readdir(directory)) {
    if (file.startsWith(".")) continue;
    const assetPath = `/images/${kind}/${file}`;
    if (!seen.has(assetPath)) throw new Error(`Missing attribution: ${assetPath}`);
  }
}
process.stdout.write(`Validated ${manifest.assets.length} attributed local assets.\n`);
