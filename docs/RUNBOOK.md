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

For the complete browser regression, run `pnpm test:e2e` while PostgreSQL is available. The test
runner starts or reuses the development server and runs the public journey serially in desktop and
mobile Chromium to limit local resource use. Install its pinned runtime once with `pnpm exec
playwright install chromium` if Playwright reports that the browser executable is missing.

Public-data smoke checks:

- `/ranking` shows all seeded players, tied competition ranks, and client-side search.
- `/player/sample-ace` shows identity, roster, ranking, and deliberate `—`/missing-data states.
- `/about` explains random pairing and scoring without defining what “better” means.
- `/privacy` explains the anonymous cookie, non-counting quota/risk states, retention categories,
  external data, and the pre-launch contact placeholder.

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
pnpm job:build-pool-draft -- --edition 2026
pnpm job:snapshot-ranking -- --edition 2026 --date YYYY-MM-DD
pnpm assets:check
```

Keep `HLTV_SYNC_ENABLED=false` until the User-Agent, low-frequency schedule, and source URLs have
been reviewed. Never respond to blocking by bypassing access controls. A failed sync is visible in
Admin under **Sync runs / parser failures** and leaves stale snapshots intact.

The safe operating order is: sync → inspect and approve each source snapshot → generate Pool draft
→ inspect conflicts/freshness/JSON → approve or reject individual proposals. The generator reports
possible removals but deliberately cannot remove live Pool entries.

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

Railway deployment, migrations, backup/restore, scheduled jobs, alerts, and incident procedures are
completed and tested in Milestone 9. This file must be expanded before staging approval.
