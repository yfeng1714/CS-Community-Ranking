# API Notes

The complete V0.1 API contract remains in `docs/IMPLEMENTATION_PLAN_V0.1.md`.

## Implemented in Milestone 0

- `GET /api/health/live` — process liveness; returns `200` and no internal details.
- `GET /api/health/ready` — validates PostgreSQL connectivity; returns `200` or detail-free `503`.

Both health responses use `Cache-Control: no-store`.

Milestone 2 adds domain services and trusted local Pool CLI commands, not HTTP endpoints. This keeps
business rules independent of Next.js and lets the later Admin routes call the same audited service
layer.

## Implemented in Milestone 3

### `POST /api/v1/ballots/next`

Returns the caller's current unexpired open Ballot or atomically issues one for the active Edition.
The request has no body, but must send `Content-Type: application/json` because every mutation uses
the shared method/content-type/Origin/Fetch-Metadata guard. Browser requests are same-origin and send
the HttpOnly visitor cookie automatically.

Successful responses follow the contract in section 11.1 of the implementation plan and always use
`Cache-Control: no-store`. A newly identified browser receives `__Host-csr_visitor` with `Secure`,
`HttpOnly`, `SameSite=Lax`, `Path=/`, configurable `Max-Age`, and no `Domain`.

Repeated transport-level calls return the same Ballot and ordinal until it expires or is resolved.
This is required for safe retries and concurrency and must not be interpreted as the user-visible
refresh rule. After M4/M5, a true manual voting-page reload calls `/next`, resolves a reused Ballot as
`SKIP`, then calls `/next` again. The existing `reusedOpenBallot` response flag is the safe branch
condition; a newly issued Ballot must never be skipped merely because the navigation was a reload.

Errors:

| Status | Code                                      | Meaning                                                           |
| ------ | ----------------------------------------- | ----------------------------------------------------------------- |
| `403`  | `VISITOR_DISABLED`                        | The anonymous identity was administratively disabled              |
| `403`  | `ORIGIN_REJECTED` / `CROSS_SITE_REJECTED` | Shared mutation security guard rejected the caller                |
| `415`  | `CONTENT_TYPE_REJECTED`                   | JSON mutation content type was absent                             |
| `429`  | `INFRASTRUCTURE_RATE_LIMITED`             | Process-local availability limit; response includes `Retry-After` |
| `503`  | `NO_ACTIVE_EDITION`                       | No Edition currently accepts Ballots                              |
| `503`  | `POOL_NOT_READY`                          | Fewer than two active eligible Pool players                       |
| `503`  | `BALLOT_ISSUANCE_UNAVAILABLE`             | Detail-free unexpected failure response                           |

See `docs/BALLOT_ISSUANCE.md` for transaction, cache, randomness, and risk-display details.

## Implemented in Milestone 4

### `POST /api/v1/ballots/{publicId}/resolve`

Accepts a strict JSON body with one `choice` of `LEFT`, `RIGHT`, or `SKIP`. The caller must own the
Ballot through the anonymous visitor cookie. The server derives all player, Edition, quota, and risk
state from the locked Ballot; these values are never client-controlled.

Successful new resolutions and same-choice idempotent replays return `200`, `no-store`, the Vote's
counted/status outcome, current left/right ranking records, and current counted head-to-head data.
The `resolution.alreadyResolved` field distinguishes a replay. Throttled and suspicious actions are
stored and return `200` with `counted: false`.

Errors:

| Status | Code                                      | Meaning                                                                |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| `400`  | `INVALID_BALLOT_ID`                       | Path identifier is not a UUID                                          |
| `400`  | `INVALID_JSON`                            | Body is not valid JSON                                                 |
| `400`  | `INVALID_RESOLUTION_CHOICE`               | Body is not exactly a valid choice                                     |
| `403`  | `VISITOR_DISABLED`                        | Anonymous identity was administratively disabled                       |
| `403`  | `ORIGIN_REJECTED` / `CROSS_SITE_REJECTED` | Shared mutation security guard rejected the caller                     |
| `404`  | `BALLOT_NOT_FOUND`                        | Ballot does not exist for this visitor; ownership is intentionally hid |
| `409`  | `BALLOT_ALREADY_RESOLVED`                 | Retry conflicts with stored choice; response includes `originalChoice` |
| `409`  | `EDITION_NOT_ACTIVE`                      | Unresolved Ballot's Edition no longer accepts effects                  |
| `410`  | `BALLOT_EXPIRED`                          | Ballot expired before resolution                                       |
| `415`  | `CONTENT_TYPE_REJECTED`                   | JSON mutation content type was absent                                  |
| `429`  | `INFRASTRUCTURE_RATE_LIMITED`             | Process-local availability limit; response includes `Retry-After`      |
| `503`  | `BALLOT_RESOLUTION_UNAVAILABLE`           | Detail-free unexpected failure response                                |

See `docs/VOTE_RESOLUTION.md` for transaction ordering, counters, revocation, and integrity checks.

## Implemented in Milestone 5

### `GET /api/v1/rankings`

Returns the active Edition and its complete public ranking projection. Equal scores receive the
same competition rank; equal-score rows are displayed by counted decisions descending, then
nickname ascending. Counts are JSON numbers only after a safe-integer check. A successful response
uses `Cache-Control: public, max-age=15, stale-while-revalidate=45`; an unexpected failure returns a
detail-free `503 RANKING_UNAVAILABLE` with `no-store`.

### `GET /api/v1/players/{slug}`

Returns the public player identity, current roster, active-Edition ranking, latest approved recent
and career Rating snapshots, and an explicit `CURRENT`, `STALE`, or `MISSING` freshness state.
Slugs must be lower-case URL-safe identifiers. Successful responses use `Cache-Control: public,
max-age=30, stale-while-revalidate=90`; invalid slugs return `400`, missing players return `404`, and
unexpected failures return a detail-free `503`, all with `no-store`.

Both are read-only public endpoints. The current server-rendered Ranking and Player pages use the
same domain queries directly, so their display contract cannot drift from the JSON projection.

## Implemented in Milestone 6

### `POST /api/v1/admin/login`

Accepts exact JSON `username` and `password`, applies the shared mutation guard and bounded login
limiter, and returns only the Admin username. Success sets the strict opaque Admin session cookie.
Missing, inactive, and wrong-password accounts all return `401 INVALID_ADMIN_CREDENTIALS`.

### `POST /api/v1/admin/logout`

Revokes the matching database session when present, clears the cookie, and returns `200` without
disclosing whether the prior token was valid.

### `POST /api/v1/admin/mutate`

Accepts a discriminated JSON action for Team, Player, Roster, Edition, Event, Candidate Pool,
pending-import review, or Vote revocation. Every request passes the shared mutation guard and a
fresh database session/active-Admin check. The actor ID always comes from that session. Success is
`200` and `no-store`; invalid input is `400`, missing auth is `401`, missing records are `404`, and
domain-state conflicts are `409`. Unexpected errors are detail-free `500` responses.

The action/body catalogue and transaction semantics are documented in `docs/ADMIN_CONSOLE.md`.
