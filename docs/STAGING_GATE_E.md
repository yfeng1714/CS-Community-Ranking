# Staging and Owner Review Gate E

Milestone 9 is complete only when this document contains evidence from the real staging environment.
Repository automation alone is preparation, not Gate E approval. Never paste passwords, database
URLs, API tokens, raw IP addresses, visitor cookies, or Admin session values here.

## Deployment record

| Item                        | Required evidence                                                                         | Result                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Railway project/environment | Project and `staging` environment names                                                   | `observant-empathy`; Railway label `production` is owner-approved for staging-only use                                                                                   |
| Region                      | Web and PostgreSQL in Singapore                                                           | Web verified Singapore; PostgreSQL placement still needs explicit evidence                                                                                               |
| Release                     | Git commit and deployment ID                                                              | Initial staging release commit `205f4c2`; later corrective commits through `1604b5a` are active; initial Web deployment `e08a8dda-95a2-468e-9018-cab2fdeea6b7`           |
| Migration gate              | Successful migration log plus deliberately failed safe test deployment                    | Config-managed migration release succeeded; deliberate safe failure pending                                                                                              |
| Private database            | Web/job `DATABASE_URL` uses Railway private reference; DB public URL absent from services | Configured with `${{Postgres.DATABASE_URL}}`; public DB URL not added to app/job services                                                                                |
| Direct route                | Railway-generated HTTPS hostname passes `pnpm ops:smoke`                                  | PASS on `https://cs-community-ranking-production.up.railway.app`; live/ready, homepage, four-player ranking, six security headers, and one isolated SKIP mutation passed |
| Custom domain               | HTTPS certificate active and `APP_ORIGIN` exact                                           | Pending                                                                                                                                                                  |

## Jobs, health, logs, and alerts

| Item               | Required evidence                                                                     | Result                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Readiness/liveness | Both endpoints return expected JSON; DB outage makes readiness 503 only               | Live/ready PASS; controlled DB-outage behavior pending                                                                                                         |
| Structured logs    | Application start, request summary, and one job result located without sensitive data | `application_start`, `expired: 0`, and zero-count retention result found; request-summary review pending                                                       |
| Scheduled jobs     | One successful execution for each configured service                                  | PASS for all six services: expire, retention, corrected 396-team VRS snapshot, healthy integrity with no violations, four-row ranking snapshot, and KPI report |
| Failure alert      | Controlled non-production job failure delivers an owner notification                  | Pending                                                                                                                                                        |
| Deployment alert   | Failed deployment notification delivered                                              | Pending                                                                                                                                                        |
| Spend controls     | Usage alert threshold and owner notification verified                                 | Owner configured $10 alert and $25 hard limit; delivery evidence pending                                                                                       |
| External tracker   | Record `not used for V0.1` or provider/test result                                    | Not used for V0.1                                                                                                                                              |

## Backup and recovery

| Item             | Required evidence                                                                 | Result                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Volume backups   | Daily and weekly schedules visible on staging PostgreSQL                          | BLOCKED on Railway Hobby; dashboard requires Pro. Owner decision needed: upgrade or approved logical-only exception                                                                  |
| Logical dump     | Matching client/server major; timestamp, age, size, and secure storage            | PARTIAL: private PostgreSQL 18.4 custom dump created in 0.191s at 135,385 bytes; deleted after drill. Durable owner-controlled storage and cadence remain pending.                   |
| Restore drill    | Separate empty DB, `backup:verify` success, duration, exact critical-table counts | PASS: empty scratch DB created in 0.326s and restored in 0.704s; all 14 critical-table counts matched; scratch DB and dump removed. No public DB exposure or extra service was used. |
| Recovery targets | Measured RPO and RTO recorded after drill                                         | PARTIAL: technical create+restore was 1.030s for this small staging dataset. Operational RPO/RTO depend on the still-pending durable backup cadence and storage choice.              |

## Proxy and network A/B

Mutation tests use sequential windows or separately configured deployments because one process has
one exact `APP_ORIGIN`. Do not weaken Origin validation to accept both test hosts indefinitely.

| Path                | Host                                             | `APP_ORIGIN`               | `CLIENT_IP_MODE` | `TRUST_PROXY_HEADERS` | Smoke   | Load                                |
| ------------------- | ------------------------------------------------ | -------------------------- | ---------------- | --------------------- | ------- | ----------------------------------- |
| Railway/direct      | `cs-community-ranking-production.up.railway.app` | Exact Railway HTTPS origin | `railway`        | `true`                | PASS    | PASS, 50 scenarios at concurrency 5 |
| Cloudflare proxied  | Pending                                          | Pending                    | `cloudflare`     | `true`                | Pending | Pending                             |
| Cloudflare DNS-only | Pending                                          | Pending                    | `railway`        | `true`                | Pending | Pending                             |

For each path record page TTFB, `/next` + `SKIP` p50/p95/failure rate, security headers, and observed
client-IP mode. DNS-only and the Railway-generated route must use publicly trusted origin TLS;
Cloudflare Origin CA alone is insufficient for direct browsers.

| Network/window              | Direct p50/p95/fail | Proxied p50/p95/fail | DNS-only p50/p95/fail | Notes |
| --------------------------- | ------------------- | -------------------- | --------------------- | ----- |
| China Telecom, normal       | Pending             | Pending              | Pending               |       |
| China Unicom, normal        | Pending             | Pending              | Pending               |       |
| China Mobile, normal        | Pending             | Pending              | Pending               |       |
| China Telecom, evening peak | Pending             | Pending              | Pending               |       |
| China Unicom, evening peak  | Pending             | Pending              | Pending               |       |
| China Mobile, evening peak  | Pending             | Pending              | Pending               |       |

## Security review

- [x] Production placeholders rejected; secrets are distinct and stored only in Railway variables.
- [x] Direct-host smoke found all six required response-security headers and completed one isolated
      Ballot SKIP without changing ranking scores.
- [x] Active Admin `owner` was created through the hidden trusted-host prompt. Login rendered the
      correct Edition/Pool/integrity state and an attributed `ADMIN_LOGIN` audit entry; logout
      returned to `/admin/login`, and a subsequent `/admin` request was redirected to login.
- [x] The real Admin login response was `no-store`, `noindex`, HSTS, CSP, anti-framing, MIME-safe,
      no-referrer, and denied camera/geolocation/microphone permissions.
- [ ] Admin and visitor cookies are Secure, HttpOnly, host-only, and have expected SameSite policy.
- [ ] CSP, HSTS, anti-framing, MIME, referrer, and permissions headers pass over every route.
- [ ] Railway mode ignores `CF-Connecting-IP`; Cloudflare mode uses the edge-provided header.
- [ ] No raw IP, cookie, token, password, provider body, or database URL appears in logs/errors.
- [ ] `RISK_ENFORCEMENT_MODE=observe`; no false-positive tuning is claimed before closed beta.
- [ ] Cloudflare can be disabled without code or database changes.
- [ ] Admin mutation Origin validation succeeds only for the currently configured host.
- [ ] Direct database public exposure is temporary/tunnel-only for the restore drill, then removed.

## Load evidence

Run the bounded SKIP-only scenario first at 50 requests / concurrency 5. Increase only after metrics
show headroom; the tool caps at 500 requests and concurrency 20. Record Railway CPU/memory/database
connections, response p50/p95/p99, non-2xx statuses, and whether limits—not integrity—caused errors.

| Window                                   | Requests / concurrency | HTTP statuses           | Scenario p50 / p95 / p99 | Resource observation                                                                                                                                  | Post-check                                                                             |
| ---------------------------------------- | ---------------------- | ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Railway direct, owner staging connection | 50 / 5                 | 100 × `200`; 0 failures | 950 / 1,539 / 1,977 ms   | Near the window, Web chart was about 0.03 vCPU and 140 MB; post-window DB query found one active connection. These are observations, not peak claims. | PASS: 51 valid SKIPs in total, zero decisions, zero score sum, no integrity violations |

## Owner decision

- Gate E status: **Pending**
- Cloudflare launch mode: **Pending real three-network A/B**
- Blocking findings: **Pending**
- Owner approval/date: **Pending**

M10 cannot create the real production Pool or begin closed beta until every required row is filled,
blocking findings are resolved, and the owner explicitly approves this gate.

## Staging bootstrap and mutation note

The guarded bootstrap created Edition `2026`, two fictional teams, and four fictional players only
after confirming the Railway staging identifiers and an empty product dataset. The first mutation
smoke attempt issued a Ballot but its harness expected the identifier under the wrong JSON property,
so that Ballot remained open and will be closed by the normal expiration job. The corrected harness
used the documented public `ballot.id`, issued a fresh isolated Ballot, and immediately resolved it
as `SKIP`. No counted pair decision was created. Integrity remained healthy with no violations.
