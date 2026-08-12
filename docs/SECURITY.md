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

## Deferred controls

Broader site-wide security headers, IP-risk processing, retention jobs, and abuse enforcement remain
in their scheduled milestones. Their invariants remain defined by the Implementation Plan.

Never add a raw IP, visitor cookie, Admin token, password, or complete provider HTML body to logs.
