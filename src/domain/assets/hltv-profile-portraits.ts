import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { DomainError } from "../error.ts";
import type { ReviewManualManifest } from "../pool/review-manual-manifest.ts";
import type { SpecialRetiredManifest } from "../pool/special-retired-manifest.ts";

export const HLTV_PROFILE_PORTRAIT_VERSION = "hltv-player-profile-bodyshot-json-v1";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const recordSchema = z.strictObject({
  contentType: z.string().trim().min(1),
  externalId: z.string().regex(/^[1-9]\d*$/),
  externalSlug: slug,
  file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/),
  nickname: z.string().trim().min(1).max(100),
  profileUrl: z.url({ protocol: /^https$/ }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  slug,
  source: z.enum(["REVIEW_MANUAL", "SPECIAL_RETIRED"]),
  sourceUrl: z.url({ protocol: /^https$/ }),
});

export const hltvProfilePortraitBundleSchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  notes: z.array(z.string().trim().min(1).max(2_000)).min(1),
  records: z.array(recordSchema).min(1),
  version: z.literal(1),
});

export type HltvProfilePortraitBundle = z.infer<typeof hltvProfilePortraitBundleSchema>;
export type HltvProfilePortraitRecord = HltvProfilePortraitBundle["records"][number];

export interface HltvProfilePortraitTarget {
  externalId: string;
  externalSlug: string;
  nickname: string;
  profileUrl: string;
  slug: string;
  source: "REVIEW_MANUAL" | "SPECIAL_RETIRED";
}

export function portraitAssetPath(playerSlug: string): string {
  return `/images/players/${playerSlug}.webp`;
}

export function listHltvProfilePortraitTargets(input: {
  reviewManual: ReviewManualManifest;
  specialRetired: SpecialRetiredManifest;
}): HltvProfilePortraitTarget[] {
  const reviewManual = input.reviewManual.teams.flatMap((team) =>
    team.players.map((player) => ({
      externalId: player.hltvIdentity.externalId,
      externalSlug: player.hltvIdentity.externalSlug,
      nickname: player.nickname,
      profileUrl: player.hltvProfileUrl,
      slug: player.slug,
      source: "REVIEW_MANUAL" as const,
    })),
  );
  const specialRetired = input.specialRetired.players
    .filter((player) => player.slug !== "machinewjq")
    .map((player) => ({
      externalId: player.hltvIdentity.externalId,
      externalSlug: player.hltvIdentity.externalSlug,
      nickname: player.nickname,
      profileUrl: player.hltvProfileUrl,
      slug: player.slug,
      source: "SPECIAL_RETIRED" as const,
    }));
  const targets = [...reviewManual, ...specialRetired];
  const slugs = new Set<string>();
  for (const target of targets) {
    if (slugs.has(target.slug)) {
      throw new DomainError(
        "HLTV_PROFILE_PORTRAIT_SLUG_DUPLICATE",
        `Duplicate portrait slug ${target.slug}`,
      );
    }
    slugs.add(target.slug);
  }
  return targets;
}

export function assertHltvPlayerBodyshotUrl(url: string, player: HltvProfilePortraitTarget): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DomainError(
      "HLTV_PROFILE_PORTRAIT_SOURCE_INVALID",
      `Portrait URL for ${player.slug} is not a valid URL`,
    );
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "img-cdn.hltv.org" ||
    !parsed.pathname.startsWith("/playerbodyshot/")
  ) {
    throw new DomainError(
      "HLTV_PROFILE_PORTRAIT_SOURCE_INVALID",
      `Portrait URL for ${player.slug} must be an official HLTV playerbodyshot`,
    );
  }
  return parsed;
}

export function assertPortraitIdentifiesPlayer(
  player: HltvProfilePortraitTarget,
  labels: { alt: string | null; title: string | null },
): void {
  const haystack = `${labels.alt ?? ""} ${labels.title ?? ""}`.toLowerCase();
  if (!haystack.includes(player.nickname.toLowerCase())) {
    throw new DomainError(
      "HLTV_PROFILE_PORTRAIT_IDENTITY_MISMATCH",
      `Portrait labels for ${player.slug} do not include nickname ${player.nickname}`,
    );
  }
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateHltvProfilePortraitBundle(
  input: unknown,
  targets: readonly HltvProfilePortraitTarget[],
): HltvProfilePortraitBundle {
  const bundle = hltvProfilePortraitBundleSchema.parse(input);
  const expected = new Map(targets.map((target) => [target.slug, target]));
  if (bundle.records.length !== targets.length) {
    throw new DomainError(
      "HLTV_PROFILE_PORTRAIT_COVERAGE_MISMATCH",
      `Portrait bundle must cover ${targets.length} players exactly once`,
    );
  }
  const seen = new Set<string>();
  for (const record of bundle.records) {
    const target = expected.get(record.slug);
    if (!target || seen.has(record.slug)) {
      throw new DomainError(
        "HLTV_PROFILE_PORTRAIT_COVERAGE_MISMATCH",
        `Portrait bundle has unexpected or duplicate slug ${record.slug}`,
      );
    }
    seen.add(record.slug);
    if (
      record.externalId !== target.externalId ||
      record.externalSlug !== target.externalSlug ||
      record.nickname !== target.nickname ||
      record.profileUrl !== target.profileUrl ||
      record.source !== target.source ||
      record.file !== `${record.slug}.webp`
    ) {
      throw new DomainError(
        "HLTV_PROFILE_PORTRAIT_IDENTITY_MISMATCH",
        `Portrait record for ${record.slug} does not match its configured identity`,
      );
    }
    assertHltvPlayerBodyshotUrl(record.sourceUrl, target);
  }
  return bundle;
}

export async function loadHltvProfilePortraitBundle(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(file), "utf8"));
}
