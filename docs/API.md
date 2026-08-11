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
