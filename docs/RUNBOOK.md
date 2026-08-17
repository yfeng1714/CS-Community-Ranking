# Operations Runbook

## Local foundation

1. Copy `.env.example` to `.env` and replace placeholder secrets for any non-local environment.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install with `pnpm install --frozen-lockfile`.
4. Apply committed migrations with `pnpm db:migrate`.
5. Optionally load fictional local sample data with `pnpm db:seed`.
6. Start the application with `pnpm dev`.
7. Check `/api/health/live` and `/api/health/ready`.
8. Open `/` for the public Vote page and `/ranking` for the public ranking.

Create the first real local Admin from a trusted terminal (the password prompt is hidden):

```bash
pnpm admin:create -- --username=owner
```

Then open `/admin/login`. There is deliberately no web registration or recovery flow. Session
duration, cookie name, and login attempt bound are configured by `ADMIN_SESSION_TTL_HOURS`,
`ADMIN_SESSION_COOKIE_NAME`, and `ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE`. Use a distinct random
`ADMIN_SESSION_SECRET` outside local development. Deactivating an Admin or revoking its session row
takes effect on the next protected request.

The fictional seed activates its Edition only when no other Edition is active. Test M3 issuance from
the browser console with:

```js
await fetch("/api/v1/ballots/next", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
}).then((response) => response.json());
```

The first request creates a secure anonymous visitor cookie. Resolve that Ballot from the same
browser context by substituting its returned UUID:

```js
await fetch("/api/v1/ballots/BALLOT_UUID/resolve", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ choice: "LEFT" }),
}).then((response) => response.json());
```

Repeating the same choice is an idempotent transport retry; changing the choice returns a conflict.
The M5 voting page automates the approved true-refresh-as-Skip workflow. To smoke-test it, leave a
Ballot unresolved, record its displayed daily ordinal, manually reload `/`, and confirm that the new
ordinal is exactly one higher. Ordinary React rerenders and repeated transport calls must preserve
the open Ballot. After a normal Vote or Skip, confirm the result remains visible until **Next** is
clicked.

For the complete browser regression, run `pnpm test:e2e` while PostgreSQL is available. Its fixture
setup applies committed migrations before creating/updating the test Admin, preventing a stale local
schema from producing page-render failures. The test runner starts or reuses the development server
and runs the public journey serially in desktop and mobile Chromium to limit local resource use.
Install its pinned runtime once with `pnpm exec
playwright install chromium` if Playwright reports that the browser executable is missing.

Public-data smoke checks:

- `/ranking` shows all seeded players, tied competition ranks, and client-side search.
- `/player/sample-ace` shows identity, roster, ranking, and deliberate `—`/missing-data states.
- `/about` explains random pairing and scoring without defining what “better” means.
- The footer and About page contain no retired `/privacy` link. Direct `/privacy` requests return
  the ordinary Next.js not-found response for the small community beta.

Admin smoke checks:

- `/admin` redirects to `/admin/login` without a valid database session.
- Login sets only the strict opaque Admin cookie and reaches the Control room dashboard.
- Disable then re-enable one Pool player's pairing state with different reasons; confirm both the
  general audit and Pool Change Log show the actions and score integrity remains healthy.
- Update a Player's professional status and confirm the next Ballot request cannot select an
  ineligible Player. In-process active-Pool snapshots are cleared immediately; selected rows are
  still revalidated in PostgreSQL.
- Use **Add starter from admitted team** for a formal roster replacement. Do not use Special
  admission: the resulting Player entry must reference the Pool Team entry and inherit its category.
- Search a Vote by an exact numeric ID before revocation; the default table intentionally shows only
  the most recent 100 Votes.
- Revoke only a known test Vote; confirm it remains visible as `REVOKED`, its counted effects are
  reversed, and both general and moderation audit rows exist.
- A pending import with conflicts, a newer source run, or changed expected state must fail approval
  and remain `PENDING`. Pool proposals must also match the envelope Edition, and automatic Team
  proposals must contain reviewable ranking/event evidence.

If the default host port `5432` is occupied, set `POSTGRES_PORT` to an available
port in `.env` and use the same port in `DATABASE_URL`. PostgreSQL continues to
listen on port `5432` inside the container.

Run `pnpm test:integration` to create, migrate, test, and remove the isolated
`csr_integration_test` database. The configured development database is never dropped by this
lifecycle.

CI now provisions pinned PostgreSQL, applies committed migrations to an empty database, and runs
this integration suite. It must remain fixture-only; never add a live provider request to CI.

## External data jobs

Run jobs only from a trusted scheduled service or terminal with database access. They are one-shot
commands and never run inside the web request path.

```bash
pnpm job:sync-vrs
pnpm job:sync-hltv -- --rankingUrl <official-ranking-url> --published <ISO-timestamp>
pnpm job:sync-hltv -- --start YYYY-MM-DD --end YYYY-MM-DD
pnpm source:capture-reviewed-hltv-stats -- --start YYYY-MM-DD --end YYYY-MM-DD --output <ignored-reviewed-json>
pnpm source:create-reviewed-hltv-stats-template -- --captured <ISO-time> --start YYYY-MM-DD --end YYYY-MM-DD --output <ignored-reviewed-json>
pnpm source:import-reviewed-hltv-stats -- --file <ignored-reviewed-json>
pnpm job:build-pool-draft -- --edition 2026
pnpm job:snapshot-ranking -- --edition 2026 --date YYYY-MM-DD
pnpm assets:check
```

`assets:check` is deliberately a local Owner/developer verification: it requires the ignored
`assets/attribution.json` source record and compares it with tracked `assets/registry.json` plus the
served files. CI, production images, and public/Admin responses never receive the detailed record.

Keep `HLTV_SYNC_ENABLED=false` until the User-Agent, low-frequency schedule, and source URLs have
been reviewed. Never respond to blocking by bypassing access controls. A failed sync is visible in
Admin under **Sync runs / parser failures** and leaves stale snapshots intact.

If the bounded Player-stat adapter is blocked or its saved fixture no longer matches the live page,
follow `docs/HLTV_PLAYER_STATS.md`. Capture official player-profile HTML locally instead of typing
70 rows:

```bash
pnpm source:capture-reviewed-hltv-stats -- \
  --start 2026-05-16 --end 2026-08-16 \
  --output data/reviewed-sources/hltv-player-stats-local.json
```

The command uses Playwright Chromium, one profile at a time, with an 8s default delay, one
retry after an access denial, and a stop after three consecutive denials so a Cloudflare block
cannot turn into 70 failed requests. `--resume` fills only missing identities in an existing
current-schema ignored JSON. `--force` is required after a parser/schema bump (v1/v2 files without
Top 20 / nationality cannot be resumed). Career Rating, ADR, and Round Swing stay `null` unless the
profile actually exposes them. Firepower, Majors won, Total MVPs, Top 20 overview years, and the
profile flag are captured from the same page. It does not enable `HLTV_SYNC_ENABLED`, does not call
`/stats/players/`, and must not run in CI. Then validate:

```bash
pnpm source:import-reviewed-hltv-stats -- --file data/reviewed-sources/hltv-player-stats-local.json
```

After checking its checksum, period, coverage, missing metrics, and exact URLs, apply only to the
intended database with an active Admin and both mutation flags:

```bash
pnpm source:import-reviewed-hltv-stats -- --file data/reviewed-sources/hltv-player-stats-local.json \
  --actor owner --reason "Reviewed official HLTV Player stats" \
  --apply --confirm-reviewed-stats
```

Production apply uses the same flags against a private Railway SSH tunnel (`railway connect Postgres
--environment production --ssh --tunnel-only`), not `railway run`, because `railway run` injects the
private `postgres.railway.internal` hostname which the laptop cannot reach. The ignored JSON never
leaves the operator machine. The bundle must cover every configured HLTV Player identity exactly
once, but may explicitly record missing recent, career, Top 20, or nationality values. Never
substitute a three-month Rating for career Rating, and never infer nationality from the current team.
The input file is ignored and should be retained only as private operational evidence; accepted
metrics land in `player_stat_snapshot`, and parsed flags land in `player.country_code`, with the
exact official source URL and capture timestamp.

The safe operating order is: sync → inspect and approve each source snapshot → generate Pool draft
→ inspect conflicts/freshness/JSON → approve or reject individual proposals. The generator reports
possible removals but deliberately cannot remove live Pool entries.

The Admin dashboard's **Pool update workflow** card summarizes that same state and names the exact
next action. It does not schedule work or approve anything. Valve VRS is scheduled weekly on Monday
at 04:00 Shanghai time and produces an unapproved snapshot. HLTV ranking/stats remain deliberate
manual jobs. Pool drafting is also manual after both source snapshots are approved; every resulting
proposal still requires separate Admin review.

## M10 launch-readiness gate

Use `docs/LAUNCH_GATE_F.md` as the evidence record. The current Railway database is fictional M9
staging even though its environment label is `production`; never relabel its Edition or disguise
its fixtures as real history. ADR 0006 approves the lowest-cost boundary: after a final verified
backup/restore/R2 copy and separate destructive-action approval, pause Web and all scheduled
services, reset the confirmed existing Railway database's application schema in place, and rebuild
it from committed migrations. Keep the same database service; do not create a second Railway DB.
Create the production Admin and DRAFT Edition through audited commands, and never run either seed.

To minimize paid overlap, first rehearse canonical data, source sync, conflict resolution, and the
review-only Pool draft in a separate clean local database. Keep it distinct from the fictional
development database, apply migrations without either seed, and run Docker only during the review
window. Near closed beta, pause the current services, make one final verified staging backup/R2
copy, reset the confirmed existing application schema, apply migrations, and repeat the flow with
fresh sources before resuming service. Never restore the rehearsal database as a shortcut around
production Admin/source approvals.

Validate the DRAFT canonical proposal without touching a database:

```bash
pnpm canonical:bootstrap
```

After Owner review changes its state to `OWNER_APPROVED`, an empty migrated rehearsal/production DB
with an active `owner` Admin can apply it only with both explicit mutation flags:

```bash
pnpm canonical:bootstrap -- --actor owner --apply --confirm-canonical-bootstrap
```

The command creates the DRAFT Edition, canonical Teams/Players, HLTV identities, roster observations,
and ordinary audit rows in one transaction. It refuses non-empty product tables and never admits the
Pool or activates the Edition. See `docs/CANONICAL_BOOTSTRAP.md`.

After the latest HLTV/VRS snapshots and Pool proposals have been reviewed, run this read-only gate
against the rebuilt target while the Edition remains `DRAFT`:

```bash
pnpm launch:check -- --edition 2026
```

The command prints JSON and exits `1` when any launch blocker exists. It deliberately blocks stale
or missing approved sources, a missing/partial/outdated Pool-draft run, unresolved proposals,
ineligible or stale-roster Pool players, missing zeroed rankings/identities/audit history, integrity
violations, non-observe risk configuration, and unattributed configured assets. Missing optional
images or stats are warnings and must be acknowledged. Run `pnpm assets:check` locally as the
companion filesystem/source-record validation; deployed readiness uses only the tracked minimal
asset registry.

A successful report is evidence, not activation authority. Preserve it with the frozen commit and
deployment ID, complete the remaining operational rows in `docs/LAUNCH_GATE_F.md`, then obtain the
Owner's explicit approval before the one audited `DRAFT` → `ACTIVE` transition or real-user beta.

## M8 analytics, integrity, and retention jobs

Run these one-shot commands from a trusted terminal or the M9 scheduled services:

```bash
pnpm report:kpi -- --edition 2026 --date YYYY-MM-DD
pnpm job:integrity-check -- --edition 2026
pnpm job:expire-ballots -- --batch 500
pnpm job:retention-cleanup
```

Dates use `Asia/Shanghai`. The KPI report is first-party and reports issuance/decision averages,
resolution/skip/throttle rates, per-player skip rate, repeat visitors, result-to-Next and
post-vote-ranking navigation, provider freshness, and public voting API latency/errors. A missing
denominator is `null`, never an invented percentage.

`job:integrity-check` exits nonzero on a violation and should alert in M9. Never repair data
automatically from the job output; preserve the report and investigate transactions/audit logs.
`job:expire-ballots` is bounded and idempotent. `job:retention-cleanup` keeps Vote/ranking history,
nulls expired network HMACs on durable Ballot/Vote rows, purges transient risk observations, and
purges expired product/API metric rows.

Keep `RISK_ENFORCEMENT_MODE=observe` through initial closed beta. Switching to `enforce` is a
configuration action but should follow false-positive review of shared campus/office/NAT traffic.
`TRUST_PROXY_HEADERS=true` is safe only when the app is reached exclusively through the selected
Railway or Cloudflare proxy mode; otherwise leave it false.

## Candidate Pool CLI

Milestone 2 provides trusted operational commands before the Admin UI exists:

```bash
pnpm pool:add-player -- --actor <admin-username> --edition <code> \
  --slug <player-slug> --nickname <nickname> --reason <public-reason>
pnpm pool:disable-player -- --actor <admin-username> --edition <code> \
  --player <player-slug> --reason <public-reason>
```

Run them only from a trusted host with database access. They write Pool Change Log and Admin Audit
Log rows. See `docs/CANDIDATE_POOL.md` for semantics and examples.

The M6 Admin Console is now the normal interactive operator path. The CLIs remain useful for trusted
recovery and automation and retain the same audited domain rules.

## Resource-conscious Docker use

Docker Desktop is required locally only when PostgreSQL or a production-container check is needed.
Unit tests, linting, type checking, and ordinary code editing do not require it.

```bash
docker compose up -d postgres   # start only for DB work
docker compose stop postgres    # stop the project database afterward
```

On macOS, quitting Docker Desktop after the container stops also shuts down its Linux VM and returns
its reserved CPU and memory. Start it again only for the next database or image validation session.

## Health meaning

- Liveness failure means the Node process cannot answer HTTP.
- Readiness failure means validated application startup or PostgreSQL connectivity is unavailable.
- A DRAFT/FROZEN Edition is product state, not process unhealthiness.

## Ballot issuance triage

- `NO_ACTIVE_EDITION`: activate exactly one prepared Edition; do not treat this as database failure.
- `POOL_NOT_READY`: confirm at least two Pool players are pairing-enabled and professionally active.
- `INFRASTRUCTURE_RATE_LIMITED`: wait for `Retry-After`; this limiter is process-local and is not the
  daily ranking quota.
- `BALLOT_ISSUANCE_UNAVAILABLE`: inspect structured logs by request ID and safe error code. Never log
  the visitor cookie or token.

## Vote and score triage

Run `pnpm score:check -- --edition <code>` after suspicious moderation activity, a failed release,
or any ranking discrepancy. A healthy report has `healthy: true`, `scoreSum: "0"`, and no
violations. The command is read-only and exits nonzero if it detects a mismatch; preserve the report
and investigate transaction/audit history before attempting any manual repair.

- `BALLOT_ALREADY_RESOLVED`: the client retried with a different choice; use `originalChoice` as the
  authoritative result.
- `BALLOT_EXPIRED`: request a new Ballot; expired opportunities are not refunded.
- `EDITION_NOT_ACTIVE`: the Edition closed before this unresolved Ballot could create an effect.
- `BALLOT_RESOLUTION_UNAVAILABLE`: correlate the request ID with safe structured logs. Do not expose
  database error text or visitor identity.

## Railway staging release

Create one Railway project with a `staging` environment, PostgreSQL, the web service, and the six
one-shot services listed in `railway/README.md`. Set each service's Config-as-code path to its
matching committed JSON file. Keep Web and PostgreSQL in Singapore and reference the PostgreSQL
private `DATABASE_URL`; do not give normal web/job traffic `DATABASE_PUBLIC_URL`.

Set production-mode application values in Railway variables. Generate independent random values of
at least 32 characters for `VISITOR_TOKEN_HASH_PEPPER`, `IP_HMAC_SECRET`, and
`ADMIN_SESSION_SECRET`; never copy local placeholders. For the initial direct Railway path:

```text
NODE_ENV=production
APP_ORIGIN=https://<exact-public-host>
CLIENT_IP_MODE=railway
TRUST_PROXY_HEADERS=true
RISK_ENFORCEMENT_MODE=observe
```

`APP_ORIGIN` must be the exact public origin the browser uses, with no path or trailing slash.
Renaming a Railway-generated hostname (for example
`cs-community-ranking-production.up.railway.app` → `yebangtv.up.railway.app`) does not update this
variable. Ranking and About keep working because they are GET pages; Vote POSTs `/api/v1/ballots/next`
and is rejected with `403 ORIGIN_REJECTED` / `Request rejected` until `APP_ORIGIN` matches. After
changing the hostname, set the web service variable and wait for the triggered redeploy:

```bash
railway variable set APP_ORIGIN=https://<new-host> --service CS-Community-Ranking --environment production
```

Do not add a second allowed origin. Cookies are `__Host-` scoped, so visitors on the new host start
clean identities; that is expected.

The web config runs committed migrations as a pre-deploy command from the newly built image. A
nonzero migration exit blocks the release. Confirm this once with a temporary staging-only branch
whose pre-deploy command deliberately exits nonzero, record the failed deployment notification,
then redeploy the reviewed commit. Never test migration failure against production and never seed as
part of deployment.

After deploy, run read-only smoke checks, then one SKIP-only mutation:

```bash
pnpm ops:smoke -- --origin https://<exact-staging-host>
pnpm ops:smoke -- --origin https://<exact-staging-host> --skip-vote --confirm-staging
```

Before the first mutation check, bootstrap the empty direct-Railway staging database once from the
trusted Web console. This command is intentionally separate from deployment, requires Railway's
runtime identity plus the generated HTTPS hostname, and refuses any database that already contains
an active Admin, Edition, Team, Player, or Vote:

```bash
pnpm db:seed:staging -- --confirm-staging
```

It inserts only the explicitly fictional development Edition/Pool. Never run it after real product
data exists, against a custom domain, or as a recurring/deploy command.

Create the staging Admin through a trusted Railway shell/one-shot invocation; do not expose the
database publicly for this. Confirm liveness, readiness, Admin login/logout, Pool audit, and one
revoked test Vote using fictional staging data only.

## Schedules and alert matrix

Railway cron uses UTC. The committed schedules translate to Shanghai time and are staggered:

- expire Ballots every 10 minutes;
- integrity 02:30 daily, retention 02:50, snapshot 03:10, KPI 03:30;
- Valve VRS Monday 04:00; review the resulting snapshot in Admin;
- HLTV remains a manual trusted command until its URL/date window and low-frequency cadence are
  approved. Keep `HLTV_SYNC_ENABLED=false` otherwise.

Trigger each job once in staging and record its deployment ID, exit status, and safe JSON result in
`docs/STAGING_GATE_E.md`. Configure Railway project notifications for failed deploys and crashed or
failed cron runs, then prove delivery using one controlled staging failure. Configure an owner usage
alert below the monthly comfort budget and Railway's wider hard limit separately; record threshold
and delivery without committing billing details.

V0.1 uses Railway JSON logs and platform notifications. Sentry remains optional and blank by
default; the app must operate unchanged when no external tracker is configured. Inspect logs for
`application_start`, public API summaries, one Admin action, one sync, and every scheduled result.
Search for accidental cookies, tokens, raw IPs, passwords, provider bodies, and database URLs before
Gate E.

## Backup and restore drill

ADR 0004 selects Railway Hobby plus portable logical backups for the early product. The lack of
platform volume backups/PITR is an accepted cost tradeoff, not permission to run without a retained
backup. Use `pg_dump`/`pg_restore` with the same major version as the Railway PostgreSQL service; an
older client cannot safely dump a newer server.

Prefer a Railway CLI SSH tunnel so PostgreSQL remains private. `railway connect --ssh --tunnel-only`
prints a temporary local connection URL and holds the tunnel open; use that URL from a second trusted
terminal:

```bash
DATABASE_URL=<staging-tunnel-url> pnpm backup:create -- --output backups/staging.dump
```

The ignored local `backups/` directory contains the dump and a non-secret manifest of critical-table
row counts. Never commit either file. While data is fictional/rebuildable, back up at least weekly
and before consequential migrations/imports. Starting with meaningful closed-beta Votes, run daily,
retain seven daily and four weekly recovery points, and keep a second independent protected copy.
Local capacity is approved, but the laptop alone is not a disaster-recovery boundary. A private
object store or an existing encrypted owner backup destination is acceptable; it must not become a
public application dependency.

Create a new, empty scratch database and verify the complete restore at least monthly and after a
material schema change:

```bash
DATABASE_URL=<source-url> RESTORE_DATABASE_URL=<empty-scratch-url> \
  pnpm backup:verify -- --dump backups/staging.dump
```

The command refuses the source database and a nonempty target, runs `pg_restore --exit-on-error`,
and compares exact row counts for ranking, Vote, Pool, visitor, and audit tables. Run integrity and
public smoke checks against the restored DB, record dump age and restore duration as measured RPO/RTO,
then delete the scratch service through the Railway dashboard after review. Remove any temporary
public database exposure/tunnel. The early-product target after real voting starts is RPO 24 hours
and operator-driven RTO 4 hours; upgrade the process or Railway plan when those are insufficient.

## Cloudflare and Mainland China A/B

ADR 0005 selects the Railway-generated HTTPS hostname for staging and the initial small closed beta.
No custom domain or Cloudflare proxy is required for the current Gate E. Continue direct-route
smoke/load/security checks and record Mainland China Telecom, Unicom, and Mobile behavior where
testers are available. Cloudflare columns may be marked owner-deferred rather than left ambiguously
pending.

Railway provides network-layer protection but no application-layer WAF. The application therefore
keeps exact Origin/Fetch-Metadata guards, strict cookies, bounded in-process rate limits, PostgreSQL
quota/risk truth, integrity checks, request/KPI logs, spend controls, and incident procedures active
on the direct route. Reopen ADR 0005 when bot traffic, an application-layer incident, resource/cost
anomalies, multi-replica scale, branding, or route measurements justify it. Do not respond to
hypothetical scale by adding Turnstile or distributed infrastructure now.

If Cloudflare later enters scope, keep the direct Railway HTTPS hostname working during the test
window. Test Cloudflare-proxied and DNS-only custom-host windows sequentially (or with separately
configured staging deployments) because mutation security permits one exact `APP_ORIGIN`. Use
`CLIENT_IP_MODE=cloudflare` only for proxied traffic and `railway` for direct/DNS-only traffic; both
require trusted proxy headers only when the origin cannot be reached outside the selected trusted
path.

Run the smoke command and then the bounded, SKIP-only load scenario per path:

```bash
pnpm ops:load -- --origin https://<current-host> --requests 50 --concurrency 5 --confirm-staging
```

The tool caps requests at 500 and concurrency at 20. Watch web CPU/memory, PostgreSQL connections,
logs, and failures. Test China Telecom, Unicom, and Mobile during normal and evening-peak windows;
record TTFB and `/next` + `/resolve` p50/p95/failure rate in `docs/STAGING_GATE_E.md`. Cloudflare
Origin CA is not sufficient for the direct/DNS-only route; retain publicly trusted Railway TLS.

## Incident procedures

- Web unavailable: check deployment health/logs and `/live`; rollback the application deployment if
  the previous schema remains compatible. Do not roll back a forward migration by rewriting files.
- Readiness unavailable: stop mutation testing, check PostgreSQL metrics/private DNS, and preserve
  errors. Liveness may remain healthy while DB readiness returns 503.
- Integrity job failure: freeze Admin mutations and external approvals, preserve the report, run
  `score:check`, and investigate audit/transaction history. Never auto-repair.
- Bad deploy/migration: traffic must remain on the last healthy deployment. Diagnose on a restored
  copy, create a reviewed forward migration, and redeploy.
- Data loss/corruption: stop writes, choose the newest safe volume/PITR/logical recovery point,
  restore to a sibling database, run integrity/smoke checks, then explicitly switch `DATABASE_URL`.
- Cloudflare degradation: set the custom host DNS-only or use the direct Railway hostname, change
  `APP_ORIGIN` and `CLIENT_IP_MODE` for that window, redeploy, and repeat smoke. Ranking correctness
  and daily quota do not change.
- Cost spike: pause external sync and nonessential cron services first, inspect request/job logs and
  database load, then apply infrastructure limits. Never change score/quota truth to reduce cost.

Use `docs/STAGING_GATE_E.md` for accepted M9 staging evidence and `docs/LAUNCH_GATE_F.md` for the M10
production-data, closed-beta, and launch boundary. Cloudflare A/B becomes required only if
Cloudflare enters scope.
