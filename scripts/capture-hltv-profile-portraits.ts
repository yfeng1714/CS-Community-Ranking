import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import "./playwright-browser-path.ts";
import { chromium, type Browser, type Page } from "@playwright/test";

import {
  assertHltvPlayerBodyshotUrl,
  assertPortraitIdentifiesPlayer,
  HLTV_PROFILE_PORTRAIT_VERSION,
  listHltvProfilePortraitTargets,
  sha256Hex,
  type HltvProfilePortraitBundle,
  type HltvProfilePortraitRecord,
  type HltvProfilePortraitSource,
  type HltvProfilePortraitTarget,
} from "../src/domain/assets/hltv-profile-portraits.ts";
import { DomainError } from "../src/domain/error.ts";
import { loadCanonicalManifest } from "../src/domain/canonical/manifest.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import { loadSpecialRetiredManifest } from "../src/domain/pool/special-retired-manifest.ts";
import { cliArgs } from "./cli-args.ts";

const CONSECUTIVE_DENIAL_LIMIT = 3;
const ACCESS_DENIED_RETRY_DELAY_MS = 20_000;
const PLAYER_CAPTURE_TIMEOUT_MS = 40_000;
const PAGE_OPTIONS = {
  locale: "en-US",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
} as const;

const args = parseArgs({
  args: cliArgs(),
  options: {
    canonical: { type: "string" },
    "delay-ms": { type: "string" },
    headed: { type: "boolean" },
    output: { type: "string" },
    "player-slug": { type: "string" },
    "review-manual": { type: "string" },
    resume: { type: "boolean" },
    source: { type: "string" },
    "special-retired": { type: "string" },
  },
  strict: true,
}).values;

function integerOption(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new DomainError("CLI_OPTION_INVALID", `${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseSourceOption(value: string | undefined): HltvProfilePortraitSource | undefined {
  if (value === undefined) return undefined;
  if (value === "CORE" || value === "REVIEW_MANUAL" || value === "SPECIAL_RETIRED") return value;
  throw new DomainError(
    "CLI_OPTION_INVALID",
    "--source must be CORE, REVIEW_MANUAL, or SPECIAL_RETIRED",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableCaptureError(error: unknown): boolean {
  if (error instanceof DomainError && error.code === "HLTV_ACCESS_DENIED") return true;
  const message = error instanceof Error ? error.message : "";
  return /Timeout \d+ms exceeded|ERR_PROXY_CONNECTION_FAILED|ERR_CONNECTION|ERR_TUNNEL|HTTP 403|HTTP 429|HTTP 503/i.test(
    message,
  );
}

function loadSharp() {
  const pnpm = path.join(process.cwd(), "node_modules/.pnpm");
  const directory = readdirSync(pnpm).find((name) => name.startsWith("sharp@"));
  if (!directory) {
    throw new DomainError(
      "SHARP_NOT_INSTALLED",
      "sharp is required to convert HLTV portraits to WebP",
    );
  }
  return createRequire(path.join(pnpm, directory, "node_modules/sharp/package.json"))("sharp");
}

async function withTimeout<T>(work: Promise<T>, ms: number, slug: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new DomainError("HLTV_CAPTURE_TIMEOUT", `${slug} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadProfile(page: Page, url: string): Promise<void> {
  page.setDefaultTimeout(25_000);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const status = response?.status() ?? 0;
  if (status === 403 || status === 429 || status === 503) {
    throw new DomainError("HLTV_ACCESS_DENIED", `HLTV returned HTTP ${status}`);
  }
  await page.waitForSelector(".player-summary-stat-box-left-bodyshot, .playerNickname", {
    timeout: 15_000,
  });
}

async function capturePortrait(
  page: Page,
  player: HltvProfilePortraitTarget,
  sharp: ReturnType<typeof loadSharp>,
): Promise<{
  bytes: Buffer;
  record: Omit<HltvProfilePortraitRecord, "sha256"> & { sha256?: string };
}> {
  const labels = await page.evaluate(() => {
    const image = document.querySelector("img.player-summary-stat-box-left-bodyshot");
    return {
      alt: image?.getAttribute("alt") ?? null,
      src:
        image?.getAttribute("src") ||
        image?.getAttribute("data-cookieblock-src") ||
        image?.getAttribute("data-src") ||
        null,
      title: image?.getAttribute("title") ?? null,
    };
  });
  if (!labels.src) {
    throw new DomainError(
      "HLTV_PROFILE_PORTRAIT_MISSING",
      `No HLTV bodyshot URL on ${player.profileUrl}`,
    );
  }
  assertPortraitIdentifiesPlayer(player, labels);
  const sourceUrl = assertHltvPlayerBodyshotUrl(labels.src, player).toString();
  const downloaded = await page.evaluate(async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const type = response.headers.get("content-type") ?? "application/octet-stream";
    const buffer = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of buffer) binary += String.fromCharCode(byte);
    return { base64: btoa(binary), type };
  }, sourceUrl);
  const raw = Buffer.from(downloaded.base64, "base64");
  const webp: Buffer = await sharp(raw).rotate().webp({ quality: 82, effort: 6 }).toBuffer();
  return {
    bytes: webp,
    record: {
      contentType: downloaded.type,
      externalId: player.externalId,
      externalSlug: player.externalSlug,
      file: `${player.slug}.webp`,
      nickname: player.nickname,
      profileUrl: player.profileUrl,
      slug: player.slug,
      source: player.source,
      sourceUrl,
    },
  };
}

async function replacePage(browser: Browser, page: Page | null): Promise<Page> {
  if (page) await page.close().catch(() => undefined);
  const next = await browser.newPage(PAGE_OPTIONS);
  next.setDefaultNavigationTimeout(25_000);
  next.setDefaultTimeout(25_000);
  return next;
}

const delayMs = integerOption(args["delay-ms"], 8_000, "--delay-ms");
const sourceFilter = parseSourceOption(args.source);
const outputFile = path.resolve(
  args.output ??
    (sourceFilter === "CORE"
      ? "data/reviewed-sources/hltv-profile-portraits-core-local.json"
      : "data/reviewed-sources/hltv-profile-portraits-local.json"),
);
const outputDirectory = path.join(
  path.dirname(outputFile),
  sourceFilter === "CORE" ? "hltv-profile-portraits-core" : "hltv-profile-portraits",
);
const canonical = await loadCanonicalManifest(args.canonical ?? "data/canonical/2026-beta.json");
const reviewManual = await loadReviewManualManifest(
  args["review-manual"] ?? "data/review-manual/2026-08-17.json",
);
const specialRetired = await loadSpecialRetiredManifest(
  args["special-retired"] ?? "data/review-manual/special-retired-2026-08-17.json",
);
const targets = listHltvProfilePortraitTargets({
  canonical,
  reviewManual,
  specialRetired,
  ...(sourceFilter === undefined ? {} : { source: sourceFilter }),
}).filter((target) => !args["player-slug"] || target.slug === args["player-slug"]);
if (targets.length === 0) {
  throw new DomainError("HLTV_PROFILE_PORTRAIT_EMPTY", "No portrait targets matched");
}

let existing: HltvProfilePortraitBundle | null = null;
if (args.resume) {
  existing = JSON.parse(await readFile(outputFile, "utf8")) as HltvProfilePortraitBundle;
}

const recordsBySlug = new Map(existing?.records.map((record) => [record.slug, record]) ?? []);
const pending = targets.filter((target) => !recordsBySlug.has(target.slug));
const sharp = loadSharp();
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  args: ["--no-proxy-server"],
  headless: args.headed !== true,
});
let page = await replacePage(browser, null);
const failures: Array<{ slug: string; reason: string }> = [];
try {
  let consecutiveDenials = 0;
  let circuitOpen = false;
  for (const [index, player] of pending.entries()) {
    if (circuitOpen) {
      failures.push({ slug: player.slug, reason: "skipped after consecutive HLTV access denials" });
      continue;
    }
    if (index > 0 && delayMs > 0) await sleep(delayMs);
    try {
      const capture = await withTimeout(
        (async () => {
          await loadProfile(page, player.profileUrl);
          return capturePortrait(page, player, sharp);
        })(),
        PLAYER_CAPTURE_TIMEOUT_MS,
        player.slug,
      ).catch(async (error) => {
        if (!isRetryableCaptureError(error)) throw error;
        page = await replacePage(browser, page);
        await sleep(ACCESS_DENIED_RETRY_DELAY_MS);
        await loadProfile(page, player.profileUrl);
        return capturePortrait(page, player, sharp);
      });
      const sha256 = sha256Hex(capture.bytes);
      const record: HltvProfilePortraitRecord = { ...capture.record, sha256 };
      await writeFile(path.join(outputDirectory, record.file), capture.bytes);
      recordsBySlug.set(player.slug, record);
      consecutiveDenials = 0;
      process.stderr.write(
        `${recordsBySlug.size}/${targets.length} ${player.slug} ${record.sourceUrl}\n`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown failure";
      failures.push({ slug: player.slug, reason });
      process.stderr.write(`failed ${player.slug}: ${reason}\n`);
      page = await replacePage(browser, page);
      if (isRetryableCaptureError(error) || /HLTV returned HTTP 403|timed out after/.test(reason)) {
        consecutiveDenials += 1;
        if (consecutiveDenials >= CONSECUTIVE_DENIAL_LIMIT) circuitOpen = true;
      }
    }
  }
} finally {
  await browser.close();
}

const records = targets
  .map((target) => recordsBySlug.get(target.slug))
  .filter((record): record is HltvProfilePortraitRecord => record !== undefined);
const bundle: HltvProfilePortraitBundle = {
  capturedAt: new Date().toISOString(),
  notes: [
    `${HLTV_PROFILE_PORTRAIT_VERSION}. Official HLTV player-profile body shots, converted to local WebP. Public pages never fetch HLTV.`,
  ],
  records,
  version: 1,
};
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(bundle, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ captured: records.length, failures, output: outputFile, pending: pending.length })}\n`,
);
if (failures.length > 0 || records.length !== targets.length) {
  process.exitCode = 1;
}
