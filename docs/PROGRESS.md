# Implementation Progress

## Current position

- **Milestone:** 10 — Candidate Pool V1, closed beta, and launch (**in progress; production beta
  active, final Gate F sign-off pending**)
- **Status:** The Owner-approved ADR 0006 cutover was executed on 2026-08-15. A final fictional-
  staging dump matched Railway and local SHA-256, restored with all critical counts, and was copied
  to private R2. The existing Railway database was reset in place with Web/crons stopped, committed
  migrations recreated a clean schema, and the real canonical manifest created 14 Teams, 70
  Players, and the DRAFT `2026 Beta Edition`. Reviewed August 10 HLTV top-12 snapshot ID 1 and live
  official August 3 Valve VRS snapshot ID 2 were approved; proposal IDs 1–14 admitted the exact
  Core-only Pool with no conflicts or removals. Production `launch:check` returned `blocking: false`,
  2,415 possible pairs, healthy integrity, and only provisional-rights/missing-optional-stats
  warnings. Edition ID 1 is ACTIVE. The read-only direct-host smoke passed liveness, readiness,
  public routes, 70-player ranking data, and six security headers without creating a test Vote.
- **Review boundary:** The one-time pre-user reset exception is consumed. Railway now contains real
  beta data, so future work must preserve history with forward migrations and retained backups. The
  initial launch scope is Core-only; Review Auto, Review Manual, the 2026 T1 whitelist, Special
  Players, and complete optional stats are deferred. Closed-beta observation and final Owner Gate F
  sign-off remain.
- **Last updated:** 2026-08-15

## Completed in the repository

- Public Vote headlines are `二选一投票箱` / `社区投票结果`, slightly smaller than the previous
  poster-sized type. Vote cards and Player pages display the local 200×200 portraits at native-friendly
  sizes instead of stretching them as full-bleed posters.
- The public Vote UI no longer shows remaining daily quota, a post-quota banner, or a distinct
  non-counting result for `THROTTLED` votes. Backend issuance and resolution still apply the Edition
  quota; `SUSPICIOUS` votes can still be presented as non-counting.
- Owner raised the daily full-weight Ballot default from 50 to 150. Ordered migration
  `0004_edition_daily_quota_150` updates the column default and existing Edition rows that still used
  50. Canonical `2026-beta.json`, seed, and `DEFAULT_FULL_WEIGHT_BALLOTS_PER_DAY` match. After deploy,
  confirm the live Edition row is 150 and set the Railway env var to 150 so Admin create defaults
  match.

- M10 adds a fail-closed canonical bootstrap boundary. `data/canonical/2026-beta.json` is an
  Owner-approved input containing the 14-Team union of the August 3 Valve and August 10 HLTV top-12
  sources, 70 direct Player HLTV identities/profile links, and five observed current starters per
  Team. `pnpm canonical:bootstrap` is dry-run only by default; apply requires Owner-approved metadata,
  an active Admin, two explicit flags, and empty product tables, then writes the DRAFT Edition and
  all canonical/audit rows atomically. It never admits a Pool entry or activates the Edition.
- The isolated local bootstrap rehearsal passed with 14 Teams, 70 Players, 70 current roster rows,
  84 identities, 239 audit rows, and an empty Pool. A live official August 3 Valve snapshot (396
  Teams) and checksum-locked reviewed August 10 HLTV top 12 were approved through audited paths. The
  initial live HLTV adapter attempt, Owner-requested retry, and a third post-network-restart retry all
  correctly failed closed on HTTP 403 while ordinary Owner-browser access worked. Each request has a
  separate failed run and none wrote a partial snapshot. The draft succeeded with 14 conflict-free
  proposals and ten retained warnings; nothing was auto-applied.
- After explicit Owner approval, all 14 exact proposal IDs passed guarded dry-run and were reviewed
  through `PendingImportReviewService`. The result is 14 Core Team rows, 70 pairing-enabled starters,
  70 zeroed rankings, 14 review audits, 14 Team admission logs, and 70 Team-player admission logs.
  Full integrity is healthy and local `launch:check` passes with `blocking: false`, 2,415 possible
  pairs, and only missing-image/missing-optional-stat warnings.
- The trusted `pending:review` CLI previews only explicitly supplied IDs and requires actor, reason,
  apply, and confirmation inputs. Its first real dry run exposed unsupported Node strip-only
  constructor syntax in `PendingImportReviewService`; the class now uses equivalent explicit fields,
  so the trusted CLI path is actually executable rather than merely type-tested.
- The first isolated Player-stat rehearsal deliberately probed one official three-month HLTV Player
  URL before attempting the 70-request job. The identified direct request returned HTTP 403, so no
  batch hammering or partial database write was attempted. The ordinary browser loaded the same page
  and confirmed Rating 3.0 plus Maps Played, while also proving that the saved parser fixture's
  synthetic labels no longer represent the live structure. A guarded reviewed-stats JSON importer
  now validates checksum, dates, exact official URLs, complete configured-identity coverage, ID/slug
  matches, explicit missing metrics, duplicate capture time, and Admin confirmation before one
  atomic metric/audit write. A generated exact 70-identity local bundle then passed dry run and
  atomic import in an isolated clone: only the one browser-observed recent karrigan metric was
  stored, while 69 recent and all 70 career values remained honestly missing. Railway was not
  changed.
- The reviewed HLTV ranking boundary now distinguishes exact top-12 Core coverage from exact top-20
  Review Auto coverage, with separate parser labels and fail-closed URL/date/rank/identity/roster
  validation. Exact August 10 ranks 13–20 were not reliably extractable through the permitted
  paths, so the current fallback remains top 12 and is not overstated as complete Review Auto
  evidence.
- The Admin overview now includes a read-only Pool update workflow card. It summarizes the latest
  HLTV/VRS approval state, Pool-draft state, pending/conflicted Pool proposals, and names one exact
  next action without scheduling, approving, or admitting anything.
- `docs/M10_CANDIDATE_POOL_REVIEW_2026-08-15.md` records the 14-Team Core rehearsal, the completed
  IEM Cologne Major Top 8 (all already Core), the open top-20/T1/manual/special decisions, and the
  clean-room transport failure separately from product evidence.
- Pool drafting now applies the Owner-approved roster rule exactly: an HLTV roster mismatch blocks;
  a VRS mismatch is retained as an `HLTV_ROSTER_AUTHORITY_APPLIED` warning. Unmatched rank-13–20 VRS
  rows without qualifying Event evidence are warnings rather than false missing-Core blockers.
- The Owner removed the personal email and dedicated `/privacy` route for the small community beta;
  existing data-minimizing controls remain. The HLTV User-Agent identifies the deployed project URL.
  Real images may use the honest `OWNER_ACCEPTED_PENDING_RIGHTS` status while the Owner handles
  external rights later. The asset passes now configure all 14 Team logos and all 70 Player
  portraits, and `assets:check` validates 84/84. Exact source URLs and notes
  now remain in a Git/Docker-ignored local file; the tracked registry exposes only path and review
  state to launch readiness. Neither source detail nor notes are rendered by public or Admin UI.
- Public Ballot, Ranking, and Player projections now carry nullable `teamLogoUrl` and render the
  local mark in a neutral contrast container. This closes the pre-existing gap where Admin/database
  could store `logoPath` but the public product never consumed it; missing paths still degrade to
  Team text without a broken image.

- M10 adds `pnpm launch:check -- --edition <code>`, a read-only JSON report that exits nonzero on
  missing/stale approved HLTV/VRS inputs, an incomplete or outdated Pool draft, unresolved imports,
  eligibility/roster drift, nonzero/missing ranking baselines, missing HLTV identities, integrity
  failures, non-observe risk mode, unattributed configured assets, or incomplete Pool audit history.
  Missing optional photos/logos and stats remain explicit warnings.
- The normal Admin `DRAFT` → `ACTIVE` action re-runs that report and fails closed on any blocker.
  It cannot infer or replace Gate F's explicit Owner, image-source/right-status, beta, route, and
  backup sign-offs. The production Docker image now includes the versioned asset-attribution
  manifest used by this runtime check.
- M10 adds the nullable, audited `player.hltv_profile_url` reference field through ordered migration
  `0003`. It accepts only direct HTTPS `hltv.org/player/{id}/{slug}` URLs, is editable in Admin,
  passes through reviewed imports, and appears on the public Player page when present. Machine-facing
  provider IDs remain in `player_external_identity`.
- `docs/LAUNCH_GATE_F.md` separates repository proof from real operational proof: clean production
  provisioning, canonical data/source review, category-by-category Owner approval, asset source and
  rights-status review, pre-activation evidence, multi-device/network beta observations, limit
  tuning, backup cadence, and final sign-off. It forbids seed commands and fictional-history
  relabeling in production.
- A PostgreSQL integration test constructs a fully auditable five-player DRAFT Pool with exact
  source provenance and proves the gate both passes it and blocks unresolved import/roster drift.

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

| Command/check                       | Result | Notes                                                                                                                                                                                                                                                           |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                         | PASS   | Zero warnings.                                                                                                                                                                                                                                                  |
| `pnpm format:check`                 | PASS   | Source, JSON configuration, tests, and docs formatted.                                                                                                                                                                                                          |
| `pnpm typecheck`                    | PASS   | Strict TypeScript `6.0.3`, including the M10 report/CLI/test.                                                                                                                                                                                                   |
| `pnpm test:unit`                    | PASS   | Latest pass: 40 files, 149 tests including Admin Pool-workflow sequencing, exact reviewed-HLTV top-12/top-20 validation, null-first stats templates, Railway, CLI, backup, security, launch safety, roster-authority policy, and asset-source validation.       |
| `pnpm test:integration`             | PASS   | Full pass: 12 files, 46 tests against PostgreSQL 18, including external-source warning policy, the launch-readiness gate, nullable HLTV profile-URL migration/constraint, reviewed stats, and atomic 14-Team/70-Player canonical bootstrap with 239 audit rows. |
| `pnpm db:migrate` / `pnpm db:check` | PASS   | Ordered migrations apply; journal is consistent.                                                                                                                                                                                                                |
| Operational CLI execution           | PASS   | Integrity healthy/zero-sum; expiration and retention ran successfully.                                                                                                                                                                                          |
| Local logical restore drill         | PASS   | PostgreSQL 18 custom dump restored to separate empty DB in 1.27s; all 14 critical table counts matched; scratch DB/dump removed.                                                                                                                                |
| `pnpm build`                        | PASS   | Optimized Next.js `16.3.0` Webpack build and standalone traces.                                                                                                                                                                                                 |
| `pnpm test:e2e`                     | PASS   | 6 public/Admin journeys in desktop/mobile Chromium from a cold start. Setup now applies committed migrations and uses pinned pnpm through Corepack; harmless dev-server aborted-stream messages remained during browser teardown.                               |
| `git diff --check`                  | PASS   | No whitespace errors.                                                                                                                                                                                                                                           |
| Production Docker rebuild           | PASS   | Pinned Node 24.14.0/pnpm 11.16.0 image built; final 190,565,606-byte image runs as `node`, excludes Vitest/TypeScript, and contains Web, migration, all six cron entry points, migrations, public assets, and Next static output.                               |

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
- The first retained owner-local backup was created through a private Railway SSH tunnel with
  PostgreSQL 18.4. The 136,706-byte custom archive has 271 entries, a mode-`0600` dump and manifest,
  and SHA-256 `f15919054c41a58c306df3d7ecfd1a2d5301e62e794a9b55e5314395d4fcabc8`.
  A new isolated local PostgreSQL 18 database restored it in 631 ms with exact counts across all 14
  critical tables; the scratch server and directory were then removed. The retained local dump stays
  in the ignored `backups/` directory and its dump/manifest pair has a verified independent copy in
  the private `cs-community-ranking-backups` R2 bucket.
- The R2 bucket uses Standard storage with automatic Asia Pacific placement and public access
  disabled. Its remote object listing reports the exact local sizes: 136,706 bytes for the dump and
  483 bytes for the manifest. The temporary bucket-scoped Object Read & Write upload token was
  deleted immediately after verification; no R2 access credential is stored in the repository.
- The previously blocked production Docker validation now passes. The final image was built from the
  pinned runtime/toolchain, runs as the unprivileged `node` user, uses `node server.js` plus the
  liveness healthcheck, contains the migration and all six cron entry points, and excludes checked
  development-only Vitest/TypeScript packages. The project PostgreSQL container and Docker engine/VM
  were stopped afterward. Three idle Docker helper processes remained at 0.0% CPU after the graceful
  Desktop stop; no project container remained running.
- Gate E security closure verified all six required response headers across every current public,
  informational, Admin-login, health, and public-read route; no route exposed `X-Powered-By`. A
  live visitor cookie passed Secure/HttpOnly/host-only/Path/SameSite checks, focused Admin-cookie
  tests pass the stricter SameSite policy, and live public/Admin mutation endpoints rejected
  missing, wrong-Origin, cross-site, and invalid-content requests without setting cookies. Logger
  redaction also replaced representative cookies, tokens, password, database URL, and IP fields.
- During the first Railway CLI tunnel, its human-readable output printed the database password in a
  separate terminal field. The credential was therefore treated as exposed and rotated immediately:
  the PostgreSQL role and Railway source variable now use a new random password, all referenced Web
  and cron services redeployed successfully, and the staging smoke suite passed afterward. Both
  tunnels were closed, the temporary Railway SSH key was removed, and credential-bearing temp files
  were deleted.
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
- The owner reached the direct Railway site over China Mobile 4G and Wi-Fi. On the confirmed China
  Mobile Wi-Fi connection, a bounded 50-scenario/concurrency-5 SKIP-only window returned 100 HTTP
  `200` responses with zero failures and scenario p50/p95/p99 of 980/2,022/3,850 ms. The four
  fictional ranking scores matched exactly before and after. China Telecom/Unicom are recorded as
  tester-unavailable, not failed routes; this window is not claimed as evening-peak evidence.

## M9 accepted follow-ups

- The owner waived the separate failed-deployment notification drill. Failed-job email delivery is
  already proven, and no temporary failure-only code/config change will be introduced solely to fail
  a deployment against the only active staging service.
- Spend-alert delivery will be observed naturally if Railway sends the configured $10 alert; the
  $25 hard limit is configured and will not be deliberately approached for testing.
- China Telecom/Unicom and a separately classified China Mobile evening-peak window remain follow-up
  evidence when devices/timing are available, not current route failures. Cloudflare-only paths are
  no longer M9 blockers under ADR 0005. Singapore Web/PostgreSQL placement and the current
  provider-log request-summary review now pass.

## Next task

Before inviting meaningful beta Votes, establish and evidence the daily logical-backup cadence and
private R2 second-copy procedure required by ADR 0004. Then have the Owner confirm the existing
Admin password still signs in after the hash-only account restoration, begin the small closed-beta
observation window, and record traffic, latency, errors, resource usage, integrity, and backup
recovery evidence for final Gate F sign-off. China Telecom/Unicom and an evening-peak China Mobile
window remain useful observations when available, not route blockers.

Review Auto, Review Manual, the 2026 T1 whitelist, Special Players, a permitted low-frequency HLTV
adapter, complete optional Player stats, final branding, custom domain, and Cloudflare edge remain
deliberate later follow-ups. The ADR 0006 reset is consumed and must never be repeated against the
real beta history.
