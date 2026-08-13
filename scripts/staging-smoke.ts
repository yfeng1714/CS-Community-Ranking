import { parseArgs } from "node:util";

import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    "confirm-staging": { type: "boolean" },
    origin: { type: "string" },
    "skip-vote": { type: "boolean" },
  },
  strict: true,
}).values;

if (!args.origin) throw new Error("--origin is required");
const origin = new URL(args.origin).origin;
if (origin !== args.origin || !origin.startsWith("https://")) {
  throw new Error("--origin must be an HTTPS origin without a trailing slash or path");
}
if (args["skip-vote"] && !args["confirm-staging"]) {
  throw new Error("--skip-vote requires --confirm-staging because it creates staging rows");
}

const requiredHeaders = [
  "content-security-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-frame-options",
  "permissions-policy",
  "strict-transport-security",
] as const;

async function expectResponse(path: string, expectedStatus = 200): Promise<Response> {
  const response = await fetch(`${origin}${path}`, { cache: "no-store", redirect: "manual" });
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}; expected ${expectedStatus}`);
  }
  return response;
}

const live = await expectResponse("/api/health/live");
const ready = await expectResponse("/api/health/ready");
const page = await expectResponse("/");
await expectResponse("/ranking");
const ranking = await expectResponse("/api/v1/rankings");

for (const header of requiredHeaders) {
  if (!page.headers.has(header)) throw new Error(`Missing security header: ${header}`);
}
if (page.headers.has("x-powered-by")) throw new Error("x-powered-by must not be exposed");

const rankingBody = (await ranking.json()) as { players?: unknown };
if (!Array.isArray(rankingBody.players)) throw new Error("Ranking payload has no players array");

let mutation = "not requested";
if (args["skip-vote"]) {
  const next = await fetch(`${origin}/api/v1/ballots/next`, {
    body: "{}",
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
  if (!next.ok) throw new Error(`/next returned ${next.status}: ${await next.text()}`);
  const ballot = (await next.json()) as { ballot?: { publicId?: unknown } };
  if (typeof ballot.ballot?.publicId !== "string") throw new Error("/next returned no Ballot UUID");
  const cookie = next.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  if (!cookie) throw new Error("/next did not set a visitor cookie");
  const resolve = await fetch(
    `${origin}/api/v1/ballots/${encodeURIComponent(ballot.ballot.publicId)}/resolve`,
    {
      body: JSON.stringify({ choice: "SKIP" }),
      headers: { "content-type": "application/json", cookie, origin },
      method: "POST",
    },
  );
  if (!resolve.ok) throw new Error(`/resolve returned ${resolve.status}: ${await resolve.text()}`);
  mutation = "one isolated visitor issued and skipped one Ballot";
}

console.log(
  JSON.stringify({
    checks: {
      liveness: await live.json(),
      mutation,
      rankingPlayers: rankingBody.players.length,
      readiness: await ready.json(),
      securityHeaders: requiredHeaders.length,
    },
    origin,
    status: "passed",
  }),
);
