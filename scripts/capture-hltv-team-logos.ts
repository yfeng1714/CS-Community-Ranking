import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import "./playwright-browser-path.ts";
import { chromium, type Browser, type Page } from "@playwright/test";

import {
  assertLogoIdentifiesTeam,
  HLTV_TEAM_LOGO_VERSION,
  listHltvTeamLogoTargets,
  pickHltvTeamLogoSource,
  sha256Hex,
  type HltvTeamLogoBundle,
  type HltvTeamLogoRecord,
  type HltvTeamLogoTarget,
} from "../src/domain/assets/hltv-team-logos.ts";
import { DomainError } from "../src/domain/error.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import { cliArgs } from "./cli-args.ts";

const CONSECUTIVE_DENIAL_LIMIT = 3;
const ACCESS_DENIED_RETRY_DELAY_MS = 20_000;
const TEAM_CAPTURE_TIMEOUT_MS = 40_000;
const PAGE_OPTIONS = {
  locale: "en-US",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
} as const;

const args = parseArgs({
  args: cliArgs(),
  options: {
    "delay-ms": { type: "string" },
    headed: { type: "boolean" },
    output: { type: "string" },
    "review-manual": { type: "string" },
    resume: { type: "boolean" },
    "team-slug": { type: "string" },
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
    throw new DomainError("SHARP_NOT_INSTALLED", "sharp is required to convert HLTV team logos");
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

async function loadTeamPage(page: Page, url: string): Promise<void> {
  page.setDefaultTimeout(25_000);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const status = response?.status() ?? 0;
  if (status === 403 || status === 429 || status === 503) {
    throw new DomainError("HLTV_ACCESS_DENIED", `HLTV returned HTTP ${status}`);
  }
  await page.waitForSelector(".teamlogo, .profile-team-name, h1", { timeout: 15_000 });
}

function isSvg(bytes: Buffer, contentType: string): boolean {
  if (contentType.includes("svg")) return true;
  const head = bytes.subarray(0, 256).toString("utf8").trimStart();
  return head.startsWith("<svg") || head.startsWith("<?xml");
}

async function convertLogo(
  sharp: ReturnType<typeof loadSharp>,
  raw: Buffer,
  contentType: string,
): Promise<{ bytes: Buffer; extension: "webp" | "png" }> {
  if (isSvg(raw, contentType)) {
    const png: Buffer = await sharp(raw)
      .resize(512, 512, {
        background: { alpha: 0, b: 0, g: 0, r: 0 },
        fit: "contain",
      })
      .png()
      .toBuffer();
    return { bytes: png, extension: "png" };
  }
  const webp: Buffer = await sharp(raw).rotate().webp({ effort: 6, quality: 82 }).toBuffer();
  return { bytes: webp, extension: "webp" };
}

async function captureLogo(
  page: Page,
  team: HltvTeamLogoTarget,
  sharp: ReturnType<typeof loadSharp>,
): Promise<{ bytes: Buffer; record: Omit<HltvTeamLogoRecord, "sha256"> }> {
  const observed = await page.evaluate(() => {
    const images = [
      ...document.querySelectorAll("img.teamlogo, img.team-background-logo"),
    ] as HTMLImageElement[];
    const heading =
      document.querySelector(".profile-team-name")?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      null;
    return {
      candidates: images.map((image) => ({
        alt: image.getAttribute("alt"),
        className: image.className,
        src:
          image.getAttribute("src") ||
          image.getAttribute("data-cookieblock-src") ||
          image.getAttribute("data-src"),
        title: image.getAttribute("title"),
      })),
      heading,
    };
  });
  const picked = pickHltvTeamLogoSource(observed.candidates);
  const sourceUrl = picked.sourceUrl.toString();
  const chosen = observed.candidates.find((candidate) => candidate.src === sourceUrl);
  assertLogoIdentifiesTeam(team, {
    alt: chosen?.alt ?? null,
    heading: observed.heading,
    title: chosen?.title ?? null,
  });
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
  const converted = await convertLogo(sharp, raw, downloaded.type);
  return {
    bytes: converted.bytes,
    record: {
      contentType: downloaded.type,
      externalId: team.externalId,
      externalSlug: team.externalSlug,
      file: `${team.slug}.${converted.extension}`,
      name: team.name,
      shortName: team.shortName,
      slug: team.slug,
      sourceUrl,
      teamPageUrl: team.teamPageUrl,
      variant: picked.variant,
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
const outputFile = path.resolve(args.output ?? "data/reviewed-sources/hltv-team-logos-local.json");
const outputDirectory = path.join(path.dirname(outputFile), "hltv-team-logos");
const reviewManual = await loadReviewManualManifest(
  args["review-manual"] ?? "data/review-manual/2026-08-17.json",
);
const targets = listHltvTeamLogoTargets(reviewManual).filter(
  (target) => !args["team-slug"] || target.slug === args["team-slug"],
);
if (targets.length === 0) {
  throw new DomainError("HLTV_TEAM_LOGO_EMPTY", "No team-logo targets matched");
}

let existing: HltvTeamLogoBundle | null = null;
if (args.resume) {
  existing = JSON.parse(await readFile(outputFile, "utf8")) as HltvTeamLogoBundle;
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
  for (const [index, team] of pending.entries()) {
    if (circuitOpen) {
      failures.push({ slug: team.slug, reason: "skipped after consecutive HLTV access denials" });
      continue;
    }
    if (index > 0 && delayMs > 0) await sleep(delayMs);
    try {
      const capture = await withTimeout(
        (async () => {
          await loadTeamPage(page, team.teamPageUrl);
          return captureLogo(page, team, sharp);
        })(),
        TEAM_CAPTURE_TIMEOUT_MS,
        team.slug,
      ).catch(async (error) => {
        if (!isRetryableCaptureError(error)) throw error;
        page = await replacePage(browser, page);
        await sleep(ACCESS_DENIED_RETRY_DELAY_MS);
        await loadTeamPage(page, team.teamPageUrl);
        return captureLogo(page, team, sharp);
      });
      const sha256 = sha256Hex(capture.bytes);
      const record: HltvTeamLogoRecord = { ...capture.record, sha256 };
      await writeFile(path.join(outputDirectory, record.file), capture.bytes);
      recordsBySlug.set(team.slug, record);
      consecutiveDenials = 0;
      process.stderr.write(
        `${recordsBySlug.size}/${targets.length} ${team.slug} ${record.sourceUrl}\n`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown failure";
      failures.push({ slug: team.slug, reason });
      process.stderr.write(`failed ${team.slug}: ${reason}\n`);
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
  .filter((record): record is HltvTeamLogoRecord => record !== undefined);
const bundle: HltvTeamLogoBundle = {
  capturedAt: new Date().toISOString(),
  notes: [
    `${HLTV_TEAM_LOGO_VERSION}. Official HLTV team-page logos, converted to local WebP/PNG. Public pages never fetch HLTV. Night-only variants are preferred for the dark logo container.`,
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
