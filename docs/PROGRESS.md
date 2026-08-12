# Implementation Progress

## Current position

- **Milestone:** 8 — Anti-abuse, analytics, and integrity hardening
- **Status:** Implemented and verified; ready for owner review before Milestone 9
- **Review boundary:** Privacy-preserving daily IP HMAC risk signals, observe/enforce controls,
  bounded public API protection, first-party analytics/KPIs, integrity/retention/expiration jobs,
  request metrics/logging, and site-wide security headers are complete. No deployment occurred.
- **Last updated:** 2026-08-12

## Completed

- Trusted Railway/Cloudflare client IP input is normalized in memory only. IPv4 is canonicalized,
  IPv6 is aggregated to `/64`, and PostgreSQL stores only a 32-byte daily HMAC keyed by the
  Shanghai-local date. Proxy headers are ignored by default; an unattributed bounded bucket still
  protects availability without inventing an IP identity.
- The risk monitor records configurable new-visitor churn, extreme velocity, invalid Ballot
  ownership, replay mismatch, and impossible-flow reasons. Observe mode persists reasons without
  changing an otherwise-valid Vote; enforce mode persists `SUSPICIOUS` Ballot eligibility. Risk is
  never exposed before resolution and never replaces the per-visitor PostgreSQL quota.
- `/next`, `/resolve`, public JSON reads, and the first-party event endpoint use a bounded
  process-local public limiter. Visitor-specific limiters remain separate. Cloudflare is optional
  and ranking correctness remains database-only.
- `POST /api/v1/events` accepts only six event types and bounded page/player metadata. It rejects
  Vote choice/arbitrary metadata and degrades to `202` on analytics failure. Anonymous page views do
  not race Ballot issuance to create visitor identity.
- `report:kpi` generates a Shanghai-local daily report from first-party rows: Ballots/decisions per
  visitor, resolution/skip/throttle rates, per-player skip rate, repeat visitors, result-to-Next and
  post-vote ranking navigation, provider freshness, and public voting API latency/errors.
- One-shot jobs now provide full cross-table integrity checks, bounded open-Ballot expiration, and
  configured retention cleanup. Old Ballot/Vote IP HMACs are nulled while Votes/rankings remain;
  expired analytics and transient risk observations are purged.
- The site emits restrictive CSP, anti-framing, MIME-sniffing, referrer, and permissions headers.
  HSTS is production-and-HTTPS only. Admin keeps stricter no-referrer/noindex behavior. Structured
  public API summaries include request ID, route, status, latency, and safe error code only.
- Ordered migrations `0001_m8_integrity_hardening.sql` and
  `0002_m8_risk_key_constraints.sql` add risk observations, API metrics, Ballot risk reasons, and
  database-enforced SHA-256 key shape. No existing migration was rewritten and no production
  `db push` was used.
- Milestones 0–7 remain implemented, including the independently audited Gate D import boundary,
  authenticated Admin Console, fixture-tested external adapters, review-only Pool drafts, and
  daily ranking snapshots.

## Validation

| Command/check                   | Result | Notes                                                                    |
| ------------------------------- | ------ | ------------------------------------------------------------------------ |
| `pnpm lint`                     | PASS   | Zero warnings.                                                           |
| `pnpm format:check`             | PASS   | Source, tests, configuration, migration metadata, and docs formatted.    |
| `pnpm typecheck`                | PASS   | Strict TypeScript `6.0.3`.                                               |
| `pnpm test:unit`                | PASS   | 31 files, 106 tests: IP/HMAC, analytics, CSP, guards, and domain logic.  |
| `pnpm test:integration`         | PASS   | 9 files, 40 tests against PostgreSQL 18 and ordered fresh migrations.    |
| M8 verbose PostgreSQL scenarios | PASS   | KPI, cookie-churn signal, observe/enforce, expiry, retention, integrity. |
| `pnpm test:e2e`                 | PASS   | 6 public/Admin journeys in desktop and mobile Chromium.                  |
| `pnpm build`                    | PASS   | Optimized Next.js `16.3.0` Webpack build.                                |
| `pnpm db:check`                 | PASS   | Drizzle schema and migration journal consistent.                         |
| `git diff --check`              | PASS   | No whitespace errors.                                                    |

Docker was kept off during ordinary work, used only for PostgreSQL/browser verification, then the
project container was stopped and Docker Desktop was quit to release the local VM resources.

## Material corrections and decisions

- M8 required a forward schema change because pre-resolution risk reasons and failed abuse signals
  could not be audited in the reserved M1 fields alone. This extends the existing privacy model; it
  does not change product meaning.
- Shared-network safety is explicit: no low per-IP Vote cap exists, all risk thresholds are
  configuration, initial mode remains `observe`, and Cloudflare cannot grant extra ranking power.
- First page-view analytics may be anonymous. This avoids competing visitor-cookie creation while
  retaining later linked result/Next/ranking metrics once voting identity exists.
- CSP allows `unsafe-eval` only during local Next.js development; production does not. HSTS is not
  emitted locally and still requires real HTTPS/proxy validation in staging.

## Known limitations

- The limiter and risk-velocity map are intentionally per process for the initial single web
  instance; process restart resets them. PostgreSQL quota and exactly-once Vote correctness do not.
- IP HMAC monitoring requires correctly configured trusted proxy headers in staging. With trust off,
  there is no network correlation, only bounded unattributed availability protection.
- Risk thresholds are safe starting defaults, not production-tuned truth. Closed-beta traffic from
  shared networks must be reviewed before enforcement remains enabled.
- API timing metrics currently cover `/next` and `/resolve`; infrastructure-level saturation before
  the process must come from M9 platform monitoring.
- Scheduled-service cadence, alert delivery, Railway/Cloudflare configuration, external error
  tracking, backup/restore, and China-network validation remain Milestone 9.
- No production provider sync, real Candidate Pool draft, or production data was created.

## Next task

Wait for owner review and explicit instruction before Milestone 9. Then deploy Web/PostgreSQL/jobs
to Railway Singapore staging, apply migrations through the release path, configure schedules,
backups, alerts/logs, run a restore drill, compare Cloudflare proxy-on/DNS-only paths, and validate
Mainland China access before Owner Review Gate E.
