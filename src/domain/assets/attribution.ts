import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const attributionEntry = z
  .strictObject({
    assetPath: z.string().regex(/^\/images\/(players|teams)\/[a-zA-Z0-9._-]+$/),
    license: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(1_000).nullable(),
    permission: z.enum([
      "LICENSED",
      "OWNER_ACCEPTED_PENDING_RIGHTS",
      "OWNER_PROVIDED",
      "PERMISSION_GRANTED",
    ]),
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

export async function loadAttributionManifest(rootDirectory: string = process.cwd()) {
  const file = path.join(rootDirectory, "assets", "attribution.json");
  return attributionManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
}
