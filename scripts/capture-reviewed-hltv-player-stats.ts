import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import "./playwright-browser-path.ts";
import { chromium, type Browser, type Page } from "@playwright/test";

import { loadCanonicalManifest } from "../src/domain/canonical/manifest.ts";
import { localIsoDate, shiftIsoDateByMonths } from "../src/domain/date.ts";
import { DomainError } from "../src/domain/error.ts";
import { loadReviewManualManifest } from "../src/domain/pool/review-manual-manifest.ts";
import {
  HLTV_PLAYER_PROFILE_STATS_PARSER_VERSION,
  parseHltvPlayerProfileStatsHtml,
  type CapturedHltvProfileStats,
} from "../src/domain/external-data/providers/hltv.ts";
import {
  createReviewedHltvPlayerStatsTemplate,
  mergeCapturedRecentStats,
  validateReviewedHltvPlayerStats,
  type ReviewedHltvPlayerStats,
} from "../src/domain/external-data/reviewed-player-stats.ts";
import { peakHltvTop20 } from "../src/domain/external-data/top20.ts";
import { cliArgs } from "./cli-args.ts";

const CONSECUTIVE_DENIAL_LIMIT = 3;
const ACCESS_DENIED_RETRY_DELAY_MS = 20_000;
const PAGE_OPTIONS = {
  locale: "en-US",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
} as const;

const args = parseArgs({
  args: cliArgs(),
  options: {
    captured: { type: "string" },
    "delay-ms": { type: "string" },
    end: { type: "string" },
    force: { type: "boolean" },
    headed: { type: "boolean" },
    manifest: { type: "string" },
    output: { type: "string" },
    "player-id": { type: "string" },
    "review-manual": { type: "string" },
    resume: { type: "boolean" },
    start: { type: "string" },
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

function isAccessDenied(error: unknown): boolean {
  return error instanceof DomainError && error.code === "HLTV_ACCESS_DENIED";
}

function isRetryableCaptureError(error: unknown): boolean {
  if (isAccessDenied(error)) return true;
  if (error instanceof DomainError && error.code === "HLTV_CAPTURE_TIMEOUT") return true;
  const message = error instanceof Error ? error.message : "";
  return /Timeout \d+ms exceeded|ERR_PROXY_CONNECTION_FAILED|ERR_CONNECTION|ERR_TUNNEL/i.test(
    message,
  );
}

function captureFromRecord(
  record: ReviewedHltvPlayerStats["records"][number],
): CapturedHltvProfileStats | null {
  if (!record.recent) return null;
  return {
    adr: record.adr ?? record.recent.adr,
    careerRating: record.career?.rating ?? null,
    countryCode: record.countryCode,
    firepower: record.firepower ?? record.recent.firepower,
    majorsWon: record.majorsWon,
    maps: record.recent.maps,
    mvpCount: record.mvpCount,
    rating: record.recent.rating,
    top20Placements: record.top20Placements,
  };
}

function formatCaptureLine(captured: CapturedHltvProfileStats): string {
  const firepower = captured.firepower === null ? "—" : String(captured.firepower);
  const majors = captured.majorsWon === null ? "—" : String(captured.majorsWon);
  const mvps = captured.mvpCount === null ? "—" : String(captured.mvpCount);
  const country = captured.countryCode ?? "—";
  const peak = peakHltvTop20(captured.top20Placements);
  const top20 = peak ? `#${peak.rank} ${peak.years.join(",")}` : "—";
  return `${captured.rating} / ${captured.maps} maps / fp ${firepower} / ${majors} major / ${mvps} mvp / ${top20} / ${country}`;
}

async function loadExistingBundle(file: string): Promise<ReviewedHltvPlayerStats | null> {
  try {
    await access(file);
  } catch {
    return null;
  }
  return validateReviewedHltvPlayerStats(JSON.parse(await readFile(file, "utf8")));
}

const periodEnd = args.end ?? localIsoDate();
const periodStart = args.start ?? shiftIsoDateByMonths(periodEnd, -3, "HLTV stats period start");
const capturedAt = args.captured ?? new Date().toISOString();
const delayMs = integerOption(args["delay-ms"], 8_000, "--delay-ms");
const onlyPlayerId = args["player-id"]?.trim() || null;
const manifestFile = path.resolve(args.manifest ?? "data/canonical/2026-beta.json");
const outputFile = path.resolve(
  args.output ?? "data/reviewed-sources/hltv-player-stats-local.json",
);

const canonical = await loadCanonicalManifest(manifestFile);
const reviewManual = args["review-manual"]
  ? await loadReviewManualManifest(path.resolve(args["review-manual"]))
  : null;
const template = createReviewedHltvPlayerStatsTemplate(
  {
    teams: [...canonical.teams, ...(reviewManual?.teams ?? [])],
  },
  {
    capturedAt,
    periodEnd,
    periodStart,
  },
);
const existing = args.resume ? await loadExistingBundle(outputFile) : null;
if (existing && (existing.periodStart !== periodStart || existing.periodEnd !== periodEnd)) {
  throw new DomainError(
    "REVIEWED_STATS_RESUME_PERIOD_MISMATCH",
    "Resume file period does not match --start/--end",
  );
}

const captures = new Map<string, CapturedHltvProfileStats>();
if (existing) {
  for (const record of existing.records) {
    const captured = captureFromRecord(record);
    if (captured) captures.set(record.externalId, captured);
  }
}

const alreadyCaptured = captures.size;
const pending = template.records.filter((record) => {
  if (onlyPlayerId && record.externalId !== onlyPlayerId) return false;
  return !captures.has(record.externalId);
});
if (onlyPlayerId && pending.length === 0 && !captures.has(onlyPlayerId)) {
  throw new DomainError(
    "CLI_OPTION_INVALID",
    `--player-id ${onlyPlayerId} is not in the configured HLTV identity set`,
  );
}

if (!args.force && !args.resume) {
  try {
    await access(outputFile);
    throw new DomainError(
      "REVIEWED_STATS_OUTPUT_EXISTS",
      `${outputFile} already exists; pass --force to overwrite or --resume to fill missing rows`,
    );
  } catch (error) {
    if (error instanceof DomainError) throw error;
  }
}

const failures: Array<{ externalId: string; externalSlug: string; reason: string }> = [];
const PLAYER_CAPTURE_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new DomainError("HLTV_CAPTURE_TIMEOUT", `${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadProfile(page: Page, url: string): Promise<string> {
  page.setDefaultNavigationTimeout(25_000);
  page.setDefaultTimeout(25_000);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const status = response?.status() ?? 0;
  if (status === 403 || status === 429 || status === 503) {
    throw new DomainError("HLTV_ACCESS_DENIED", `HLTV returned HTTP ${status}`);
  }
  await page.waitForSelector(".playerNickname, .stats-window", { timeout: 15_000 }).catch(() => {
    /* parse step still fail-closes on missing markup */
  });
  return page.content();
}

async function captureFromPage(page: Page, url: string): Promise<CapturedHltvProfileStats> {
  return parseHltvPlayerProfileStatsHtml(await loadProfile(page, url));
}

async function replacePage(browser: Browser, page: Page | null): Promise<Page> {
  if (page) await page.close().catch(() => undefined);
  const next = await browser.newPage(PAGE_OPTIONS);
  next.setDefaultNavigationTimeout(25_000);
  next.setDefaultTimeout(25_000);
  return next;
}

const browser = await chromium.launch({
  args: ["--no-proxy-server"],
  headless: args.headed !== true,
});
let page = await replacePage(browser, null);
try {
  let consecutiveDenials = 0;
  let circuitOpen = false;
  for (const [index, record] of pending.entries()) {
    if (circuitOpen) {
      failures.push({
        externalId: record.externalId,
        externalSlug: record.externalSlug,
        reason: "skipped after consecutive HLTV access denials",
      });
      continue;
    }
    if (index > 0 && delayMs > 0) await sleep(delayMs);
    const profileUrl = `https://www.hltv.org/player/${record.externalId}/${record.externalSlug}`;
    try {
      let captured: CapturedHltvProfileStats;
      try {
        captured = await withTimeout(
          captureFromPage(page, profileUrl),
          PLAYER_CAPTURE_TIMEOUT_MS,
          record.externalSlug,
        );
      } catch (error) {
        if (!isRetryableCaptureError(error)) {
          throw error;
        }
        page = await replacePage(browser, page);
        await sleep(ACCESS_DENIED_RETRY_DELAY_MS);
        captured = await withTimeout(
          captureFromPage(page, profileUrl),
          PLAYER_CAPTURE_TIMEOUT_MS,
          record.externalSlug,
        );
      }
      captures.set(record.externalId, captured);
      consecutiveDenials = 0;
      process.stderr.write(
        `${captures.size}/${template.records.length} ${record.externalSlug} ${formatCaptureLine(captured)}\n`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown failure";
      failures.push({
        externalId: record.externalId,
        externalSlug: record.externalSlug,
        reason,
      });
      process.stderr.write(`failed ${record.externalSlug}: ${reason}\n`);
      page = await replacePage(browser, page);
      if (isRetryableCaptureError(error) || /HLTV returned HTTP 403|timed out after/.test(reason)) {
        consecutiveDenials += 1;
        if (consecutiveDenials >= CONSECUTIVE_DENIAL_LIMIT) circuitOpen = true;
      } else {
        consecutiveDenials = 0;
      }
    }
  }
} finally {
  await page.close().catch(() => undefined);
  await browser.close();
}

if (captures.size === 0) {
  throw new DomainError(
    "HLTV_PROFILE_CAPTURE_EMPTY",
    "No HLTV player profile exposed Past 3 months Rating 3.0 and maps",
    { failures },
  );
}

const bundle = mergeCapturedRecentStats(template, captures);
validateReviewedHltvPlayerStats(bundle);

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(bundle, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify(
    {
      alreadyCaptured,
      capturedFirepower: bundle.records.filter((record) => record.firepower !== null).length,
      capturedMajorsWon: bundle.records.filter((record) => record.majorsWon !== null).length,
      capturedMvpCount: bundle.records.filter((record) => record.mvpCount !== null).length,
      capturedNationality: bundle.records.filter((record) => record.countryCode !== null).length,
      capturedRecent: captures.size,
      capturedTop20: bundle.records.filter((record) => record.top20Placements.length > 0).length,
      circuitStopped: failures.some((failure) => failure.reason.includes("skipped after")),
      delayMs,
      failures,
      file: outputFile,
      headed: args.headed === true,
      missingRecent: bundle.records.filter((record) => record.recent === null).length,
      newlyCaptured: captures.size - alreadyCaptured,
      parserVersion: HLTV_PLAYER_PROFILE_STATS_PARSER_VERSION,
      periodEnd,
      periodStart,
      playersAttempted: pending.length,
      playersInBundle: bundle.records.length,
    },
    null,
    2,
  )}\n`,
);
if (failures.length > 0) process.exitCode = 1;
