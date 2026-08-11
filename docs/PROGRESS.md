# Implementation Progress

## Current position

- **Milestone:** 3 — Anonymous visitor and Ballot issuance
- **Status:** Complete; owner approved with the documented refresh-flow revision
- **Review boundary:** M3 approved on 2026-08-12; implementation stops before Vote resolution
- **Last updated:** 2026-08-12

## Completed

- Implemented 32-byte cryptographically random anonymous visitor tokens, strict token validation,
  HMAC-SHA-256 persistence under the configured pepper, known-visitor lookup, last-seen updates,
  disabled-visitor rejection, and safe rotation of invalid or unknown cookies.
- Implemented the secure `__Host-csr_visitor` response cookie with `Secure`, `HttpOnly`,
  `SameSite=Lax`, `Path=/`, configurable `Max-Age`, and no `Domain`.
- Implemented `POST /api/v1/ballots/next` as a Node.js Next Route Handler wrapped by the shared POST,
  JSON content-type, Origin, and Fetch-Metadata guard. All outcomes are `no-store` and unexpected
  failures are detail-free.
- Implemented one-open-Ballot issuance with Edition and visitor row locks, unexpired reuse, explicit
  expiry without quota refund, the partial-unique-index savepoint fallback, and bounded retries for
  PostgreSQL serialization failures/deadlocks.
- Implemented atomic `visitor_daily_usage` upsert/increment using the `Asia/Shanghai` issuance date;
  the returned counter is persisted as the Ballot's immutable daily ordinal.
- Implemented quota assignment from the persisted active Edition: within-limit Ballots are
  `ELIGIBLE`, later Ballots are `THROTTLED`, and enforced suspicious state stays internal before
  resolution.
- Implemented true uniform two-player selection with Node cryptographic randomness, canonical pair
  storage, and independent left/right randomization.
- Tightened active-pool lookup to pairing-enabled, professionally active players and revalidates the
  selected rows under database locks. Stale cache state is invalidated and retried transactionally.
- Implemented a configurable bounded fixed-window availability limiter with TTL cleanup, LRU
  eviction, `Retry-After`, and a strict maximum key count.
- Added minimal Ballot player cards; approved provider statistics remain explicit `null` values until
  M7 rather than invented data.
- Made the fictional development seed activate its Edition only when no other Edition is active, so
  a fresh local environment can exercise the M3 endpoint.
- Added `docs/BALLOT_ISSUANCE.md` and updated README, API, Candidate Pool, database, runbook, security,
  environment, and durable Codex handoff documentation.
- Recorded the Owner's 2026-08-12 decision that a true manual voting-page reload is an auditable
  Skip followed by a new pair. M3 transport-level `/next` reuse remains unchanged; M4 supplies
  idempotent Skip resolution and M5 supplies reload detection/orchestration. See ADR 0003.

## Validation

| Command/check           | Result | Notes                                                                                                                                                                           |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`             | PASS   | Zero warnings.                                                                                                                                                                  |
| `pnpm format:check`     | PASS   | All included files match Prettier.                                                                                                                                              |
| `pnpm typecheck`        | PASS   | Strict TypeScript `6.0.3`.                                                                                                                                                      |
| `pnpm test:unit`        | PASS   | 13 files, 44 tests; token/cookie primitives, Shanghai boundary, random mapping, retry, limiter, route guard/response, and all prior tests.                                      |
| `pnpm test:integration` | PASS   | 3 files, 16 tests against PostgreSQL 18; includes 12 concurrent issuance calls converging on one Ballot/ordinal, expiry, throttling, and stale-Pool rejection.                  |
| Local HTTP smoke test   | PASS   | Two same-origin transport-level requests returned `200`; secure cookie, `no-store`, same Ballot/ordinal, and `reusedOpenBallot: true` were verified without printing the token. |
| `pnpm test:e2e`         | PASS   | Playwright remains configured with no M3 browser journey; public voting UI begins after M4/M5.                                                                                  |
| `pnpm build`            | PASS   | Next.js `16.3.0` Webpack production build, including the Node.js Ballot Route Handler.                                                                                          |
| `pnpm db:check`         | PASS   | Existing migration journal remains valid; M3 changes no schema or migration.                                                                                                    |
| `git diff --check`      | PASS   | No whitespace errors after documentation sync.                                                                                                                                  |
| Docker image rebuild    | N/A    | No dependency, migration, Dockerfile, or container-runtime change.                                                                                                              |

## Decisions and corrections made during implementation

- M3 requires no schema migration: the reviewed M1 visitor, usage, Ballot, constraint, and index
  design already supports the full issuance transaction.
- Active-pool cache loading occurs before the transaction, then the two selected rows are revalidated
  under transaction locks. Loading on a second connection while many visitor transactions wait on
  locks could exhaust a small connection pool; prefetch plus locked revalidation preserves both
  availability and correctness.
- The visitor row lock is the normal concurrency serialization mechanism. The partial unique index
  remains the final enforcement layer, and its insert is isolated by a nested savepoint so a conflict
  cannot poison the outer transaction.
- The initial infrastructure limiter is fixed-window rather than token-bucket. Its semantics are
  deliberately availability-only and process-local; PostgreSQL remains the durable ranking quota
  authority.
- A Pool player must now be both pairing-enabled and professionally `ACTIVE`. Admission category and
  ranking values remain absent from pairing selection.
- Fresh development seeding activates the fictional Edition only if no other active Edition exists.
  This makes the implemented API testable without overriding an operator-created active Edition.
- Manual refresh must not be inferred from duplicate `/next` traffic. The M5 client will use a real
  reload-navigation signal and `reusedOpenBallot`; M4's normal idempotent Skip endpoint remains the
  only state transition. This preserves retries and avoids a second resolution implementation.
- Docker stayed off during coding and unit validation. It was started only for the PostgreSQL and
  local HTTP validation window; the project database was stopped and Docker Desktop was quit
  afterward to release its VM resources.

## Known limitations

- M3 issues but cannot resolve or skip a Ballot. Repeated transport-level `/next` calls intentionally
  return the same unexpired Ballot until M4 implements `POST /api/v1/ballots/{publicId}/resolve`.
- The newly approved manual-refresh behavior is planned and documented but cannot be user-visible
  before M4 resolution and the M5 voting page exist.
- Player statistic fields are `null`; approved snapshot ingestion remains M7.
- The availability limiter is per process and keyed by visitor identity. Multi-instance limiting,
  proxy-aware IP risk keys, observe/enforce signals, and retention belong to M8/M9.
- Clearing the visitor cookie creates a new identity. This is expected; later IP risk aggregation is
  the secondary signal and never the primary identity.
- No public voting UI or end-to-end browser journey exists yet. The voting surface begins in M5 after
  M4 establishes exactly-once resolution and result payloads.
- Candidate Pool CLI mutations occur in another process and reach a running web cache through its
  short TTL. Same-process future Admin mutations share the runtime service and invalidate immediately.

## Next task

When the owner explicitly requests it, begin Milestone 4: validate `LEFT`/`RIGHT`/`SKIP`, lock
Ballots idempotently, create exactly one Vote, apply eligible `+1/-1` effects and pair aggregates,
persist result counters, handle conflicting retries, and preserve zero-sum ranking invariants. M4's
Skip resolution must support the approved refresh workflow, but public reload detection remains M5.
