import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { DomainError } from "../error.ts";
import type { ReviewManualManifest } from "../pool/review-manual-manifest.ts";

export const HLTV_TEAM_LOGO_VERSION = "hltv-team-page-logo-json-v1";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const recordSchema = z.strictObject({
  contentType: z.string().trim().min(1),
  externalId: z.string().regex(/^[1-9]\d*$/),
  externalSlug: slug,
  file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.(webp|png)$/),
  name: z.string().trim().min(1).max(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  shortName: z.string().trim().min(1).max(32).nullable(),
  slug,
  sourceUrl: z.url({ protocol: /^https$/ }),
  teamPageUrl: z.url({ protocol: /^https$/ }),
  variant: z.enum(["night", "default", "day"]),
});

export const hltvTeamLogoBundleSchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  notes: z.array(z.string().trim().min(1).max(2_000)).min(1),
  records: z.array(recordSchema).min(1),
  version: z.literal(1),
});

export type HltvTeamLogoBundle = z.infer<typeof hltvTeamLogoBundleSchema>;
export type HltvTeamLogoRecord = HltvTeamLogoBundle["records"][number];
export type HltvTeamLogoVariant = HltvTeamLogoRecord["variant"];

export interface HltvTeamLogoTarget {
  externalId: string;
  externalSlug: string;
  name: string;
  shortName: string | null;
  slug: string;
  teamPageUrl: string;
}

export interface HltvTeamLogoCandidate {
  alt?: string | null;
  className: string;
  src: string | null;
  title?: string | null;
}

export function logoAssetPath(teamSlug: string, extension: "webp" | "png"): string {
  return `/images/teams/${teamSlug}.${extension}`;
}

export function listHltvTeamLogoTargets(manifest: ReviewManualManifest): HltvTeamLogoTarget[] {
  const targets = manifest.teams.map((team) => ({
    externalId: team.hltvIdentity.externalId,
    externalSlug: team.hltvIdentity.externalSlug,
    name: team.name,
    shortName: team.shortName,
    slug: team.slug,
    teamPageUrl: team.hltvIdentity.sourceUrl,
  }));
  const slugs = new Set<string>();
  for (const target of targets) {
    if (slugs.has(target.slug)) {
      throw new DomainError(
        "HLTV_TEAM_LOGO_SLUG_DUPLICATE",
        `Duplicate team-logo slug ${target.slug}`,
      );
    }
    slugs.add(target.slug);
  }
  return targets;
}

export function classifyHltvTeamLogoVariant(className: string): HltvTeamLogoVariant {
  if (/(?:^|\s)night-only(?:\s|$)/.test(className)) return "night";
  if (/(?:^|\s)day-only(?:\s|$)/.test(className)) return "day";
  return "default";
}

export function assertHltvTeamLogoUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DomainError("HLTV_TEAM_LOGO_SOURCE_INVALID", "Team logo URL is not a valid URL");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "img-cdn.hltv.org" ||
    !parsed.pathname.startsWith("/teamlogo/")
  ) {
    throw new DomainError(
      "HLTV_TEAM_LOGO_SOURCE_INVALID",
      "Team logo URL must be an official HLTV teamlogo",
    );
  }
  return parsed;
}

function logoWidth(url: URL): number {
  const width = Number(url.searchParams.get("w"));
  return Number.isInteger(width) && width > 0 ? width : 0;
}

const variantRank: Record<HltvTeamLogoVariant, number> = {
  night: 0,
  default: 1,
  day: 2,
};

export function pickHltvTeamLogoSource(candidates: readonly HltvTeamLogoCandidate[]): {
  sourceUrl: URL;
  variant: HltvTeamLogoVariant;
} {
  const parsed = [];
  for (const candidate of candidates) {
    if (!candidate.src) continue;
    try {
      const sourceUrl = assertHltvTeamLogoUrl(candidate.src);
      parsed.push({
        sourceUrl,
        variant: classifyHltvTeamLogoVariant(candidate.className),
        width: logoWidth(sourceUrl),
      });
    } catch {
      continue;
    }
  }
  parsed.sort(
    (left, right) =>
      variantRank[left.variant] - variantRank[right.variant] || right.width - left.width,
  );
  const chosen = parsed[0];
  if (!chosen) {
    throw new DomainError(
      "HLTV_TEAM_LOGO_MISSING",
      "No official HLTV teamlogo URL on the team page",
    );
  }
  return { sourceUrl: chosen.sourceUrl, variant: chosen.variant };
}

export function assertLogoIdentifiesTeam(
  team: HltvTeamLogoTarget,
  labels: { alt: string | null; heading: string | null; title: string | null },
): void {
  const haystack =
    `${labels.alt ?? ""} ${labels.title ?? ""} ${labels.heading ?? ""}`.toLowerCase();
  const needles = [team.name, team.shortName, team.externalSlug.replaceAll("-", " ")].filter(
    (value): value is string => Boolean(value),
  );
  if (!needles.some((needle) => haystack.includes(needle.toLowerCase()))) {
    throw new DomainError(
      "HLTV_TEAM_LOGO_IDENTITY_MISMATCH",
      `Team-page labels for ${team.slug} do not include ${team.name}`,
    );
  }
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateHltvTeamLogoBundle(
  input: unknown,
  targets: readonly HltvTeamLogoTarget[],
): HltvTeamLogoBundle {
  const bundle = hltvTeamLogoBundleSchema.parse(input);
  const expected = new Map(targets.map((target) => [target.slug, target]));
  if (bundle.records.length !== targets.length) {
    throw new DomainError(
      "HLTV_TEAM_LOGO_COVERAGE_MISMATCH",
      `Team-logo bundle must cover ${targets.length} teams exactly once`,
    );
  }
  const seen = new Set<string>();
  for (const record of bundle.records) {
    const target = expected.get(record.slug);
    if (!target || seen.has(record.slug)) {
      throw new DomainError(
        "HLTV_TEAM_LOGO_COVERAGE_MISMATCH",
        `Team-logo bundle has unexpected or duplicate slug ${record.slug}`,
      );
    }
    seen.add(record.slug);
    const extension = record.file.endsWith(".png") ? "png" : "webp";
    if (
      record.externalId !== target.externalId ||
      record.externalSlug !== target.externalSlug ||
      record.name !== target.name ||
      record.shortName !== target.shortName ||
      record.teamPageUrl !== target.teamPageUrl ||
      record.file !== `${record.slug}.${extension}`
    ) {
      throw new DomainError(
        "HLTV_TEAM_LOGO_IDENTITY_MISMATCH",
        `Team-logo record for ${record.slug} does not match its configured identity`,
      );
    }
    assertHltvTeamLogoUrl(record.sourceUrl);
  }
  return bundle;
}

export async function loadHltvTeamLogoBundle(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(file), "utf8"));
}
