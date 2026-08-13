# Security Notes

## Milestone 0 controls

- Startup environment values are validated with Zod; invalid required configuration fails startup.
- Production placeholder secrets and non-`__Host-` visitor cookie names are rejected.
- Request IDs accept only a bounded safe character set before entering logs.
- Pino emits structured JSON and redacts cookies, tokens, passwords, and database URLs.
- The mutation guard requires POST and JSON, rejects cross-site Fetch Metadata, and validates Origin
  in production.
- Health endpoints reveal only liveness/readiness state and never database error details.

## Milestone 3 controls

- Visitor identity uses a 32-byte cryptographically random base64url token. PostgreSQL stores only
  its HMAC-SHA-256 digest under the configured pepper.
- The visitor cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, has no `Domain`, and uses the
  production-enforced `__Host-` prefix.
- `POST /api/v1/ballots/next` is wrapped by the shared JSON, Origin, and Fetch-Metadata mutation
  guard; all responses are `no-store`.
- Unexpected issuance errors return no database details. Logs record only a bounded safe error code,
  never raw visitor tokens or cookies.
- The availability limiter has configurable request and key bounds with TTL/LRU eviction. Ranking
  quota and one-open-Ballot correctness remain in PostgreSQL.
- Internal suspicious eligibility is not disclosed before resolution, preventing a risk feedback
  oracle.

## Milestone 4 controls

- `POST /api/v1/ballots/{publicId}/resolve` uses the shared JSON, Origin, and Fetch-Metadata mutation
  guard, strict UUID/body validation, `no-store`, and a separate bounded availability limiter.
- Ballot ownership failures return the same detail-free `404` whether the UUID is absent or belongs
  to another visitor, preventing an ownership oracle.
- The locked Ballot—not client input—is authoritative for players, orientation, Edition, quota
  eligibility, issued risk key, expiry, and usage date.
- Suspicious and throttled status is disclosed only after the action has been irreversibly stored;
  neither changes public ranking or counted head-to-head data.
- Conflicting retries reveal only the already stored choice. Unexpected errors log a bounded safe
  code and return a detail-free `503`.
- Vote revocation requires a trusted service caller, Admin actor, and nonblank reason and writes an
  immutable moderation audit record. Its HTTP Admin surface remains M6.

## Milestone 6 controls

- Admin accounts are created only through the trusted CLI. Argon2id password hashes use a maintained
  pinned implementation; login does not disclose whether a username exists or is inactive.
- The browser holds a random opaque 32-byte token. PostgreSQL stores only its HMAC-SHA-256 digest;
  the strict `__Host-` cookie is Secure, HttpOnly, SameSite=Strict, Path=/, and has no Domain.
- Protected reads and every mutation perform a fresh database check for expiry, revocation, and an
  active Admin. UI visibility is never treated as authorization.
- Login is bounded by a small process-local availability limiter. Client identity headers are
  ignored unless proxy trust is enabled and an explicit Railway/Cloudflare mode is selected. Admin
  POSTs use the shared JSON, Origin, and Fetch-Metadata guard and never accept a browser-supplied
  actor ID.
- Admin JSON schemas are exact. Malformed JSON, unknown fields, ambiguous timestamps, and IDs
  outside the positive signed PostgreSQL-bigint range are rejected before domain work. Expected
  uniqueness/reference/check failures are mapped without returning constraint or row details.
- Every successful product mutation and login/logout state change has a same-transaction general
  audit. Pool and Vote moderation retain their specialized immutable logs as well.
- Admin pages are no-store/noindex/nofollow, deny framing, disable MIME sniffing, and use no-referrer.
  No physical-delete UI exists.
- Pending approvals re-lock the proposal and source run, reject conflicts/newer runs/state drift,
  validate an exact versioned action plus change/Edition agreement, and apply under the review
  transaction. Runtime cache invalidation occurs after commit. Rejection never applies data.

## Milestone 8 controls

- Trusted Railway `X-Real-IP` or Cloudflare `CF-Connecting-IP` values are normalized only at the
  application boundary, IPv6 is aggregated to `/64`, and the only durable value is
  `HMAC-SHA-256(secret, Shanghai-date|normalized-IP)`. With proxy trust off, identity headers are
  ignored and only a bounded unattributed availability bucket is used.
- Same-day cookie churn, request velocity, invalid Ballot ownership, replay mismatch, and impossible
  flow produce bounded reason codes. Observe mode stores reasons but leaves otherwise-valid Votes
  counted; enforce mode makes a flagged Ballot `SUSPICIOUS` without exposing the reason before
  resolution. Daily quota remains PostgreSQL truth and never depends on Cloudflare.
- Product events accept an exact event/metadata allowlist and never accept Vote choices. Anonymous
  page views do not mint visitor identity; events link only when the voting cookie already exists.
- Site-wide CSP, anti-framing, MIME-sniffing, referrer, permissions, and production HTTPS-only HSTS
  headers are configured. Development alone allows `unsafe-eval` for the Next.js debugger.
- Scheduled cleanup nulls retained IP HMACs and purges old first-party analytics/API metrics. The
  integrity job checks zero-sum ranking, Vote/aggregate agreement, uniqueness, Pool coverage, and
  pseudonymous-key shape and exits non-zero when unhealthy.

## Milestone 9 operational controls

- The production image contains reviewed migrations and trusted one-shot commands. Railway web
  pre-deploy runs migrations before traffic switches; any nonzero exit blocks the release.
- Railway service configuration fixes Web to one Singapore replica with readiness-based deployment
  health. Cron services are isolated, short-lived, never run a web server, and cannot overlap by
  becoming long-running processes.
- Staging smoke/load writes require `--confirm-staging`; load creates a fresh visitor per scenario
  and resolves only `SKIP`, preserving ranking scores. Bounds prevent accidental stress traffic.
- Logical restore verification refuses the source database and any nonempty target, uses
  `pg_restore --exit-on-error`, and checks exact critical-table counts. Dumps and manifests are
  ignored and must be stored outside the repository.
- The direct, Cloudflare-proxied, and DNS-only paths retain exact single-origin mutation validation.
  Proxy header mode changes with the path; no permanent multi-origin exception is introduced.
- Railway structured logs and platform alerts are the V0.1 baseline. External error tracking is
  optional and must never become a request-path or Mainland China dependency.

Real proxy-header behavior, notification delivery, volume-backup schedules, logical restore,
load evidence, and three-network Mainland China access remain unverified until their evidence rows
are completed in `docs/STAGING_GATE_E.md`.

Never add a raw IP, visitor cookie, Admin token, password, or complete provider HTML body to logs.
