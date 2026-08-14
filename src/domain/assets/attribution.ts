import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const assetPath = z.string().regex(/^\/images\/(players|teams)\/[a-zA-Z0-9._-]+$/);
const assetPermission = z.enum([
  "LICENSED",
  "OWNER_ACCEPTED_PENDING_RIGHTS",
  "OWNER_PROVIDED",
  "PERMISSION_GRANTED",
]);

const attributionEntry = z
  .strictObject({
    assetPath,
    license: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(1_000).nullable(),
    permission: assetPermission,
    sourceUrl: z.url().nullable(),
  })
  .superRefine((entry, context) => {
    if (entry.permission === "OWNER_ACCEPTED_PENDING_RIGHTS" && entry.sourceUrl === null) {
      context.addIssue({
        code: "custom",
        message: "is required for Owner-accepted provisional use",
        path: ["sourceUrl"],
      });
    }
  });

export const attributionManifestSchema = z.strictObject({
  assets: z.array(attributionEntry),
  version: z.literal(1),
});

export const assetRegistrySchema = z.strictObject({
  assets: z.array(
    z.strictObject({
      assetPath,
      permission: assetPermission,
    }),
  ),
  version: z.literal(1),
});

export async function loadAssetRegistry(rootDirectory: string = process.cwd()) {
  const file = path.join(rootDirectory, "assets", "registry.json");
  return assetRegistrySchema.parse(JSON.parse(await readFile(file, "utf8")));
}

export async function loadAttributionManifest(rootDirectory: string = process.cwd()) {
  const file = path.join(rootDirectory, "assets", "attribution.json");
  return attributionManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
}
