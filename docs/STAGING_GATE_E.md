# Staging and Owner Review Gate E

Milestone 9 is complete only when this document contains evidence from the real staging environment.
Repository automation alone is preparation, not Gate E approval. Never paste passwords, database
URLs, API tokens, raw IP addresses, visitor cookies, or Admin session values here.

## Deployment record

| Item                        | Required evidence                                                                         | Result                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway project/environment | Project and `staging` environment names                                                   | `observant-empathy`; Railway label `production` is owner-approved for staging-only use                                                                                                                                                                                                                                                                           |
| Region                      | Web and PostgreSQL in Singapore                                                           | PASS: signed-in Railway settings independently showed `Southeast Asia (Singapore, Singapore)` for PostgreSQL and the config-managed Web service                                                                                                                                                                                                                  |
| Release                     | Git commit and deployment ID                                                              | Active staging release commit `0db766b`; Web deployment `6dc97549-f629-4df7-bbd8-3f83aa93eb1e` is successful                                                                                                                                                                                                                                                     |
| Migration gate              | Successful migration log plus deliberately failed safe test deployment                    | PASS WITH OWNER-APPROVED EXCEPTION: config-managed migration releases succeeded. On 2026-08-14 the owner waived the deliberate failure drill because Railway exposes only Restart/Redeploy/Remove while `/railway/web.json` owns the pre-deploy command; creating evidence would require a temporary code/config change against the sole active staging service. |
| Private database            | Web/job `DATABASE_URL` uses Railway private reference; DB public URL absent from services | Configured with `${{Postgres.DATABASE_URL}}`; public DB URL not added to app/job services                                                                                                                                                                                                                                                                        |
| Direct route                | Railway-generated HTTPS hostname passes `pnpm ops:smoke`                                  | PASS on `https://cs-community-ranking-production.up.railway.app`; live/ready, homepage, four-player ranking, six security headers, and one isolated SKIP mutation passed                                                                                                                                                                                         |
| Custom domain               | HTTPS certificate active and `APP_ORIGIN` exact, when selected                            | OWNER-DEFERRED under ADR 0005; initial small closed beta uses the exact Railway-generated HTTPS origin                                                                                                                                                                                                                                                           |

## Jobs, health, logs, and alerts

| Item               | Required evidence                                                                     | Result                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Readiness/liveness | Both endpoints return expected JSON; DB outage makes readiness 503 only               | Live/ready PASS again on 2026-08-13. The detail-free readiness-503 behavior passes its focused handler test; a real Railway PostgreSQL interruption was not induced because this environment is the only deployed staging workload and that disruptive check is not needed to validate the implemented response contract.             |
| Structured logs    | Application start, request summary, and one job result located without sensitive data | PASS: `application_start`, `expired: 0`, and zero-count retention results were located. A fresh live `/ranking` visit produced an `http_request` provider-log entry containing only time, service/environment, event, latency, request ID, route, and status; no cookie, IP, request body, token, password, or database URL appeared. |
| Scheduled jobs     | One successful execution for each configured service                                  | PASS for all six services: expire, retention, corrected 396-team VRS snapshot, healthy integrity with no violations, four-row ranking snapshot, and KPI report                                                                                                                                                                        |
| Failure alert      | Controlled non-production job failure delivers an owner notification                  | PASS: owner received Railway email for the earlier safe staging VRS failure                                                                                                                                                                                                                                                           |
| Deployment alert   | Failed deployment notification delivered                                              | OWNER-APPROVED EXCEPTION on 2026-08-14: no artificial failed deployment was created against the sole active staging service. The separate failed-job email path is proven.                                                                                                                                                            |
| Spend controls     | Usage alert threshold and owner notification verified                                 | PASS WITH OWNER-APPROVED EXCEPTION: $10 email alert and $25 hard limit are configured; alert delivery remains naturally untested because the owner will not create billable usage merely to cross the threshold.                                                                                                                      |
| External tracker   | Record `not used for V0.1` or provider/test result                                    | Not used for V0.1                                                                                                                                                                                                                                                                                                                     |

## Backup and recovery

| Item             | Required evidence                                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Volume backups   | Platform schedule or explicitly approved plan exception                           | ACCEPTED EXCEPTION under ADR 0004: remain on Railway Hobby and use retained logical backups; reconsider Pro/PITR when recovery targets or real usage justify it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Logical dump     | Matching client/server major; timestamp, age, size, and secure storage            | PASS: retained PostgreSQL 18.4 custom dump created `2026-08-13T13:05:52Z` through a private Railway SSH tunnel; 136,706 bytes, 271 archive entries, SHA-256 `f15919054c41a58c306df3d7ecfd1a2d5301e62e794a9b55e5314395d4fcabc8`, and dump/manifest mode `0600`. It remains in the ignored owner-local `backups/` directory. A private Standard-storage copy is verified in R2 bucket `cs-community-ranking-backups`, with public access disabled and automatic Asia Pacific placement. The remote listing exactly matches the 136,706-byte dump and 483-byte manifest. The temporary bucket-scoped upload token was deleted after verification. Weekly fictional-staging and pre-change cadence is selected. |
| Restore drill    | Separate empty DB, `backup:verify` success, duration, exact critical-table counts | PASS: the retained dump restored into a new local PostgreSQL 18 scratch database on isolated port `65433` in 631 ms; exact counts matched for all 14 critical tables. The scratch server/directory was stopped and deleted. No Docker, public DB proxy, or extra Railway service was used.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Recovery targets | Measured RPO and RTO recorded after drill                                         | PASS: the retained recovery point was created on 2026-08-13 and its technical restore took 631 ms for the small staging dataset. ADR 0004 sets weekly fictional-staging backups, daily backups after meaningful Votes, seven daily plus four weekly recovery points, RPO 24 hours, and operator RTO 4 hours. The independent private R2 copy is verified.                                                                                                                                                                                                                                                                                                                                                   |

## Proxy and network A/B

Mutation tests use sequential windows or separately configured deployments because one process has
one exact `APP_ORIGIN`. Do not weaken Origin validation to accept both test hosts indefinitely.

| Path                | Host                                             | `APP_ORIGIN`               | `CLIENT_IP_MODE` | `TRUST_PROXY_HEADERS` | Smoke    | Load                                |
| ------------------- | ------------------------------------------------ | -------------------------- | ---------------- | --------------------- | -------- | ----------------------------------- |
| Railway/direct      | `cs-community-ranking-production.up.railway.app` | Exact Railway HTTPS origin | `railway`        | `true`                | PASS     | PASS, 50 scenarios at concurrency 5 |
| Cloudflare proxied  | Owner-deferred under ADR 0005                    | Not current launch path    | `cloudflare`     | `true`                | Deferred | Deferred                            |
| Cloudflare DNS-only | Owner-deferred under ADR 0005                    | Not current launch path    | `railway`        | `true`                | Deferred | Deferred                            |

For each path record page TTFB, `/next` + `SKIP` p50/p95/failure rate, security headers, and observed
client-IP mode. DNS-only and the Railway-generated route must use publicly trusted origin TLS;
Cloudflare Origin CA alone is insufficient for direct browsers.

| Network/window              | Direct p50/p95/fail                      | Proxied p50/p95/fail | DNS-only p50/p95/fail | Notes                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------- | -------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| China Telecom, normal       | Tester unavailable                       | Deferred             | Deferred              | Owner currently has no China Telecom device; this is unavailable evidence, not a failed route.                                                                                          |
| China Unicom, normal        | Tester unavailable                       | Deferred             | Deferred              | Owner currently has no China Unicom device; this is unavailable evidence, not a failed route.                                                                                           |
| China Mobile, normal        | 980 / 2,022 ms; 0/50 scenario failures   | Deferred             | Deferred              | Owner confirmed both China Mobile 4G and Wi-Fi reachability. The Wi-Fi window ran 50 fresh-visitor, concurrency-5, SKIP-only scenarios: 100 HTTP `200`; p99 3,850 ms; scores unchanged. |
| China Telecom, evening peak | Tester unavailable                       | Deferred             | Deferred              | Revisit when a tester is available or routing evidence makes the carrier material.                                                                                                      |
| China Unicom, evening peak  | Tester unavailable                       | Deferred             | Deferred              | Revisit when a tester is available or routing evidence makes the carrier material.                                                                                                      |
| China Mobile, evening peak  | Not separately classified by time-of-day | Deferred             | Deferred              | Current Wi-Fi window is measured but not claimed as evening-peak evidence.                                                                                                              |

## Security review

- [x] Production placeholders rejected; secrets are distinct and stored only in Railway variables.
- [x] Direct-host smoke found all six required response-security headers and completed one isolated
      Ballot SKIP without changing ranking scores.
- [x] Active Admin `owner` was created through the hidden trusted-host prompt. Login rendered the
      correct Edition/Pool/integrity state and an attributed `ADMIN_LOGIN` audit entry; logout
      returned to `/admin/login`, and a subsequent `/admin` request was redirected to login.
- [x] The real Admin login response was `no-store`, `noindex`, HSTS, CSP, anti-framing, MIME-safe,
      no-referrer, and denied camera/geolocation/microphone permissions.
- [x] A fresh live visitor cookie is Secure, HttpOnly, host-only (`__Host-`, no Domain), Path `/`,
      and SameSite=Lax; the Ballot created for inspection was immediately resolved as SKIP. Admin
      cookie options pass focused tests as Secure, HttpOnly, host-only, Path `/`, SameSite=Strict;
      the earlier real Admin login proved the configured cookie/session works end to end.
- [x] CSP, HSTS, anti-framing, MIME, referrer, and permissions headers pass on every current
      public, informational, Admin-login, health, and public-read route. No route exposed
      `X-Powered-By`.
- [x] Railway mode selects only `X-Real-IP` in the focused extraction tests. A supplied
      `CF-Connecting-IP` could not bypass live exact-Origin validation; Cloudflare-specific behavior
      remains deferred until ADR 0005 is reopened.
- [x] The logger's configured redaction paths were exercised with representative cookie, session,
      password, database URL, raw/client IP, `X-Real-IP`, and `CF-Connecting-IP` fields; every
      sensitive value rendered as `[REDACTED]`. A signed-in Railway provider-log review also found a
      fresh structured request summary with only the approved operational fields listed above and
      no sensitive request data.
- [x] `RISK_ENFORCEMENT_MODE=observe` remains the documented and config-tested staging baseline; no
      false-positive tuning or enforce-mode claim is made before closed beta.
- [x] Cloudflare is disabled without code or database changes; direct Railway smoke/load and Vote
      integrity pass.
- [x] Live Admin login and Admin mutation endpoints reject wrong Origin and cross-site requests with
      `403` before authentication or mutation work; the public mutation endpoint also rejects
      missing/wrong Origin, cross-site fetches, and invalid content type without setting a cookie.
- [x] No public database proxy was created. Both Railway SSH tunnel sessions were closed, local
      ports `65432`/`65433` were no longer listening, the temporarily registered SSH key was
      removed, and no Railway SSH keys remained after the drill.

### Backup-session credential correction

Railway CLI printed the tunnel password as a separate terminal field while opening the first
private tunnel. Treating that output as exposed, the operator generated a new random 64-character
password, changed the PostgreSQL `postgres` role through a private tunnel, updated the Railway
`POSTGRES_PASSWORD` source variable from a mode-`0600` temporary file, and verified that
`Postgres.DATABASE_URL` and `PGPASSWORD` still reference that source variable. PostgreSQL, Web, and
all six cron services then redeployed successfully; the read-only staging smoke suite passed live,
ready, public routes, four-player ranking JSON, and all six security headers. Both tunnel sessions
were closed, both temporary SSH-key registrations were removed, and every credential-bearing temp
file was deleted. No secret is recorded in this document.

## Load evidence

Run the bounded SKIP-only scenario first at 50 requests / concurrency 5. Increase only after metrics
show headroom; the tool caps at 500 requests and concurrency 20. Record Railway CPU/memory/database
connections, response p50/p95/p99, non-2xx statuses, and whether limits—not integrity—caused errors.

| Window                                   | Requests / concurrency | HTTP statuses           | Scenario p50 / p95 / p99 | Resource observation                                                                                                                                  | Post-check                                                                                            |
| ---------------------------------------- | ---------------------- | ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Railway direct, owner staging connection | 50 / 5                 | 100 × `200`; 0 failures | 950 / 1,539 / 1,977 ms   | Near the window, Web chart was about 0.03 vCPU and 140 MB; post-window DB query found one active connection. These are observations, not peak claims. | PASS: 51 valid SKIPs in total, zero decisions, zero score sum, no integrity violations                |
| China Mobile Wi-Fi, owner connection     | 50 / 5                 | 100 × `200`; 0 failures | 980 / 2,022 / 3,850 ms   | Owner confirmed the active Wi-Fi carrier as China Mobile; no contemporaneous Railway resource peak was captured.                                      | PASS: all 50 Ballots resolved as SKIP; the four fictional ranking scores exactly matched before/after |

## Owner decision

- Gate E status: **Approved**
- Backup mode: **Railway Hobby + retained logical backups under ADR 0004**
- Cloudflare launch mode: **Owner-deferred under ADR 0005; direct Railway selected**
- Blocking findings: **None. Failed-deployment and artificial spend-threshold drills are explicitly waived; unavailable carrier/evening observations remain post-gate follow-ups, not failures.**
- Owner approval/date: **Approved by the owner on 2026-08-14**

Gate E is closed. M10 is now the next authorized boundary; creating the real production Pool or
beginning closed beta must still follow M10's explicit owner-review steps and acceptance criteria.

## Staging bootstrap and mutation note

The guarded bootstrap created Edition `2026`, two fictional teams, and four fictional players only
after confirming the Railway staging identifiers and an empty product dataset. The first mutation
smoke attempt issued a Ballot but its harness expected the identifier under the wrong JSON property,
so that Ballot remained open and will be closed by the normal expiration job. The corrected harness
used the documented public `ballot.id`, issued a fresh isolated Ballot, and immediately resolved it
as `SKIP`. No counted pair decision was created. Integrity remained healthy with no violations.
