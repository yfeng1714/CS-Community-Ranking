import { parseArgs } from "node:util";

import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    concurrency: { type: "string" },
    "confirm-staging": { type: "boolean" },
    origin: { type: "string" },
    requests: { type: "string" },
  },
  strict: true,
}).values;

if (!args.origin) throw new Error("--origin is required");
if (!args["confirm-staging"]) throw new Error("--confirm-staging is required");
const origin = new URL(args.origin).origin;
if (origin !== args.origin || !origin.startsWith("https://")) {
  throw new Error("--origin must be an HTTPS origin without a trailing slash or path");
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
  name: string,
) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return parsed;
}

const requests = boundedInteger(args.requests, 50, 500, "--requests");
const concurrency = boundedInteger(args.concurrency, 5, 20, "--concurrency");
const latencies: number[] = [];
const statuses = new Map<number, number>();
let cursor = 0;

async function skipOne(): Promise<void> {
  const started = performance.now();
  const next = await fetch(`${origin}/api/v1/ballots/next`, {
    body: "{}",
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
  statuses.set(next.status, (statuses.get(next.status) ?? 0) + 1);
  if (!next.ok) return;
  const ballot = (await next.json()) as { ballot?: { id?: unknown } };
  if (typeof ballot.ballot?.id !== "string") throw new Error("/next returned no Ballot UUID");
  const cookie = next.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  const resolve = await fetch(
    `${origin}/api/v1/ballots/${encodeURIComponent(ballot.ballot.id)}/resolve`,
    {
      body: JSON.stringify({ choice: "SKIP" }),
      headers: { "content-type": "application/json", cookie, origin },
      method: "POST",
    },
  );
  statuses.set(resolve.status, (statuses.get(resolve.status) ?? 0) + 1);
  latencies.push(performance.now() - started);
}

async function worker(): Promise<void> {
  while (cursor < requests) {
    cursor += 1;
    await skipOne();
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
latencies.sort((left, right) => left - right);
const percentile = (ratio: number) => {
  const value = latencies[Math.ceil(latencies.length * ratio) - 1];
  return value === undefined ? null : Math.round(value);
};
const failures = [...statuses].reduce(
  (total, [status, count]) => total + (status >= 200 && status < 300 ? 0 : count),
  0,
);
const report = {
  concurrency,
  durationMs: Math.round(performance.now() - started),
  failures,
  note: "Each scenario uses a fresh visitor and resolves only SKIP; ranking scores are unchanged.",
  origin,
  requests,
  scenarioLatencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
  statuses: Object.fromEntries([...statuses].sort(([left], [right]) => left - right)),
};
console.log(JSON.stringify(report));
if (failures > 0 || latencies.length !== requests) process.exitCode = 1;
