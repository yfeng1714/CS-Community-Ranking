# Implementation Progress

## Current position

- **Milestone:** 9 — Staging deployment and operational readiness
- **Status:** Railway direct-host staging is deployed and healthy; fictional bootstrap, all six cron
  jobs, owner Admin login/logout, the minimum direct load window, failed-job email delivery, and a
  China Mobile 4G reachability check pass; the owner selected Hobby logical backups and explicitly
  deferred a custom domain/Cloudflare; retained recovery and formal direct-route Mainland China
  review remain in progress
- **Review boundary:** The owner-approved Hobby baseline now contains PostgreSQL, Web, and six cron
  services. The Railway-generated environment is still named `production`, but it is being treated
  only as staging for this gate; no real Candidate Pool or closed-beta launch is authorized.
- **Last updated:** 2026-08-13

## Completed in the repository

- `railway/web.json` fixes Web to one Singapore replica, checks database readiness, and runs only
  committed migrations in Railway's pre-deploy phase. A nonzero migration exit blocks traffic from
  switching. Six separate config files define bounded, short-lived schedules for Ballot expiration,
  integrity, retention, daily ranking snapshots, KPI reports, and weekly Valve VRS sync.
- The production Docker stage now includes only production dependencies plus the reviewed source,
  migrations, and trusted one-shot commands needed by Web and cron services. The unnecessary remote
  Dockerfile-frontend directive was removed after it caused an avoidable registry dependency.
- Node 24's module hooks provide a small runtime resolver for the existing `@/` TypeScript aliases.
  This corrected a pre-existing flaw: trusted CLI commands that reached aliased domain modules were
  not executable under plain Node even though their domain logic was tested.
- A shared CLI argument normalizer supports both direct `--option` invocation and the documented
  pnpm `-- --option` form. This corrected a second pre-existing flaw where pnpm 11 forwarded the
  separator and strict `parseArgs` rejected otherwise valid commands.
- `ops:smoke` checks HTTPS liveness/readiness, public routes, ranking JSON, HSTS/CSP/security headers,
  and optional one-Ballot SKIP mutation. `ops:load` runs a bounded fresh-visitor SKIP-only scenario,
  reports p50/p95/p99 and status counts, and caps requests/concurrency. Remote writes require
  `--confirm-staging`; ranking scores never change.
- `backup:create` produces a PostgreSQL custom-format dump and manifest with exact critical-table
  counts without putting credentials in process arguments. It refuses overwrite. `backup:verify`
  refuses the source database and nonempty targets, restores with `--exit-on-error`, and compares 14
  ranking/Vote/Pool/visitor/Admin-audit table counts. Backup files are ignored.
- The runbook now covers environment and private networking, release/migration failure, cron
  schedules, platform logs/notifications, spend controls, backup/restore, Cloudflare fallback,
  Mainland China A/B, load testing, and incident response. `docs/STAGING_GATE_E.md` makes every real
  acceptance item require evidence and explicit owner approval before M10.
- Railway structured JSON logs and platform alerts are the V0.1 observability baseline. Sentry stays
  optional and blank; it cannot become a request-path or Mainland China dependency. HLTV remains a
  manual operator job until a URL/date window and low-frequency schedule are deliberately approved.

## Local validation

| Command/check                       | Result  | Notes                                                                                                                                          |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                         | PASS    | Zero warnings.                                                                                                                                 |
| `pnpm format:check`                 | PASS    | Source, JSON configuration, tests, and docs formatted.                                                                                         |
| `pnpm typecheck`                    | PASS    | Strict TypeScript `6.0.3`.                                                                                                                     |
| `pnpm test:unit`                    | PASS    | 34 files, 119 tests including Railway, CLI, and backup safety.                                                                                 |
| `pnpm test:integration`             | PASS    | 9 files, 40 tests against PostgreSQL 18.                                                                                                       |
| `pnpm db:migrate` / `pnpm db:check` | PASS    | Ordered migrations apply; journal is consistent.                                                                                               |
| Operational CLI execution           | PASS    | Integrity healthy/zero-sum; expiration and retention ran successfully.                                                                         |
| Local logical restore drill         | PASS    | PostgreSQL 18 custom dump restored to separate empty DB in 1.27s; all 14 critical table counts matched; scratch DB/dump removed.               |
| `pnpm build`                        | PASS    | Optimized Next.js `16.3.0` Webpack build and standalone traces.                                                                                |
| `pnpm test:e2e`                     | PASS    | 6 public/Admin journeys in desktop/mobile Chromium. Harmless dev-server aborted-stream messages remained during browser teardown.              |
| `git diff --check`                  | PASS    | No whitespace errors.                                                                                                                          |
| Production Docker rebuild           | BLOCKED | Docker Hub metadata for the pinned Node image timed out twice. No image was produced, so final-image entry points are not claimed as verified. |

Docker Desktop was restarted once because its Linux engine initially hung. It was used only for
PostgreSQL/integration/restore work; the project database is stopped and Docker Desktop is quit after
this verification window.

## Material corrections and decisions

- M9 found that passing unit/integration tests did not prove the trusted CLI entry points could
  execute. Runtime alias resolution and pnpm separator normalization are now explicit, shared, and
  tested. All documented earlier CLI commands benefit from the correction.
- Portable backups are owner-side/tunnel operations using PostgreSQL client tools matching the
  Railway server major version. The application image intentionally does not carry a possibly older
  Debian `pg_dump` or store backup artifacts.
- Railway cron is UTC. Schedules are translated to Shanghai time and staggered after midnight to
  avoid a simultaneous database spike. HLTV is not automatically scheduled; weekly VRS creates only
  an approval-pending snapshot and cannot mutate the Candidate Pool.
- Exact single-origin mutation validation remains intact during Cloudflare testing. Proxy-on and
  DNS-only/direct mutation checks use sequential configuration windows or separate deployments;
  accepting two permanent production origins is not an approved shortcut.
- ADR 0004 records the owner-approved low-cost recovery baseline: Railway Hobby plus retained
  logical backups, with local capacity allowed and an independent second copy required before real
  public launch. The first retained dump/cadence is not complete merely because the restore drill
  passed.
- ADR 0005 records the owner-approved direct Railway baseline. The custom domain and Cloudflare A/B
  are deferred until traffic, abuse, cost, branding, scale, or route evidence justifies them. No
  application redesign is needed because correctness and anti-abuse truth do not depend on the edge.
  Direct Railway deliberately has less application-layer WAF/DDoS shielding, so request, KPI,
  resource, integrity, and spend evidence remains mandatory.
- The first live Valve VRS run exposed an upstream-format mismatch: the official heading appends an
  HTML `<br />` after its date. Parser version `valve-vrs-markdown-v2` accepts that official form
  while retaining fail-closed validation. The focused parser test, direct live-source parse, and
  corrected Railway run all pass with 396 teams; Railway stored review-only snapshot ID `1`.
- The first mutation smoke exposed a harness/API-shape mismatch: the public Ballot UUID is
  `ballot.id`, while the script expected `ballot.publicId`. The harness now follows the public API
  shape. A corrected run issued one isolated Ballot and immediately resolved it as `SKIP`; the
  earlier open diagnostic Ballot is left for the normal expiration job and never became a counted
  decision.
- The load tool carried the same stale `ballot.publicId` assumption. It was corrected before the
  first load run, preventing unresolved load Ballots. Type checking and formatting pass with both
  staging tools using `ballot.id`.

## Railway staging evidence to date

- Project `observant-empathy`, environment label `production` (owner-approved staging-label
  exception), commit `205f4c2`, and Railway host
  `https://cs-community-ranking-production.up.railway.app` are active.
- Web uses `/railway/web.json`, a private `${{Postgres.DATABASE_URL}}` reference, one Singapore
  replica, pre-deploy migrations, and readiness health checks. The final direct-host smoke passed
  liveness, readiness, homepage/ranking, four-player ranking JSON, all six required security
  headers, and one isolated SKIP mutation.
- All six unexposed cron services use their committed config paths. `expire-ballots` completed with
  `expired: 0`; `retention-cleanup` completed with zero safe cleanup counts; corrected `sync-vrs`
  stored one 396-team review-only snapshot. After the guarded fictional bootstrap,
  `integrity-check` reported healthy with no violations, `snapshot-ranking` wrote four rows, and
  `report-kpi` completed with successful VRS freshness provenance.
- The guarded bootstrap created Edition `2026`, two fictional teams, and four fictional players
  after verifying the exact Railway staging identity and an otherwise empty product dataset. It is
  fail-closed and cannot be rerun now that product data exists.
- Active Admin `owner` was created through the trusted hidden-password prompt. Real login showed the
  correct Edition, Pool, healthy integrity, VRS snapshot, Vote moderation read view, and attributed
  `ADMIN_LOGIN` audit entry. Logout redirected to login and a fresh `/admin` request remained
  protected; no product mutation or Vote revocation was performed.
- The minimum direct load window completed 50 fresh-visitor SKIP scenarios at concurrency 5 with
  100 HTTP `200` responses and zero failures. Scenario latency was p50 950 ms, p95 1,539 ms, and p99
  1,977 ms. Post-load integrity remained healthy with 51 valid SKIPs total, zero decisions, and zero
  score sum. Railway charts near the window showed about 0.03 vCPU and 140 MB; a post-window
  read-only query found one active database connection, so these are observations rather than peak
  measurements.
- Railway Hobby does not expose volume backups or PITR; its dashboard requires Pro. No plan upgrade
  was made, and ADR 0004 now approves that exception. The lower-cost path was exercised privately
  inside Railway using matching PostgreSQL 18.4 tools: a 135,385-byte custom dump completed in
  0.191s, an empty scratch database was created
  in 0.326s, and restore completed in 0.704s. All 14 critical-table counts matched. The scratch
  database and dump were removed; no public DB exposure, Mac install, or extra service was used.
- The real Admin login page returned `no-store`, noindex/nofollow, HSTS, CSP, anti-framing,
  MIME-sniffing protection, no-referrer, and restrictive permissions-policy headers.
- Owner spend controls are configured outside the repository at a $10 notification threshold and a
  $25 hard limit. Sentry is not used for V0.1.
- The owner received Railway's email for the earlier safe staging VRS failure, confirming the
  failed-job notification path. This is not evidence for the separate failed-deployment or spend
  threshold alerts.
- The owner reached the direct Railway site over China Mobile 4G. This is useful connectivity
  evidence, but no timestamped normal/evening-peak latency or Ballot timing was captured, so it does
  not complete the formal network matrix.

## Remaining M9 work and external inputs

- Create the first retained logical dump, establish the ADR 0004 cadence/retention, and select a
  second independent protected copy. Local capacity is approved; local-only is not yet durable
  disaster recovery.
- Trigger and confirm the separate failed-deployment notification. Failed-job email delivery is now
  confirmed from the earlier safe staging VRS failure.
- Complete the remaining direct-route security/log/readiness checks and formal normal/evening-peak
  tests from China Telecom, Unicom, and Mobile where available. Cloudflare-only paths are no longer
  M9 blockers under ADR 0005.
- Retry the production Docker build when Docker Hub is reachable, then inspect the final image's web,
  migration, and cron entry points.

## Next task

Retain the first Hobby logical backup, finish the applicable direct-route operational/security
evidence in `docs/STAGING_GATE_E.md`, and obtain explicit Gate E approval. Do not begin M10 or create
the real 2026 Candidate Pool before that approval.
