# Implementation Progress

## Current position

- **Milestone:** 6 — Admin Console and audited operations
- **Status:** Implemented; awaiting Owner Review Gate D before Milestone 7
- **Review boundary:** Private authentication/session management and Admin workflows are complete;
  implementation stops before external provider adapters, sync jobs, or live data ingestion
- **Last updated:** 2026-08-12

## Completed

- Added trusted `pnpm admin:create` provisioning with a hidden password prompt, normalized usernames,
  a 12-character minimum, and pinned Argon2id password hashing. Removed the unused environment-based
  bootstrap fields so there is one real account-creation path and no web registration/recovery flow.
- Added database-backed Admin sessions with random 32-byte opaque tokens, HMAC-SHA-256 digests at
  rest, configurable 12-hour expiry, bounded last-seen writes, explicit logout revocation, inactive
  Admin rejection, and a strict Secure/HttpOnly/SameSite=Strict `__Host-` cookie.
- Added bounded login throttling and detail-equivalent invalid-credential responses. All Admin POSTs
  require exact JSON, reject cross-site Fetch Metadata and mismatched Origin, verify the current
  database session, and derive the actor from that session.
- Added responsive `/admin/login` and `/admin` interfaces. The dashboard reports active Edition,
  Team/Player pool size, pending proposals, last sync, and a full score-integrity result.
- Added audited Team/Player create and update/status workflows, Roster add/end, Edition create and
  forward transition, Event create/whitelist, Pool Team/Special Player admission, and pairing toggle.
  There is no physical-delete control.
- Added pending imported-change review with versioned proposals, row/source-run locking, conflict and
  newer-run rejection, expected-state comparison, typed action validation, nested-savepoint domain
  application, and same-transaction approve/reject audit state. M7 will populate the currently empty
  queue using this contract.
- Added Vote-revocation UI and made revocation write both the specialized moderation record and the
  general Admin Audit Log in the same transaction as counter rollback.
- Added separate General Audit, Pool Change, Moderation, and sync/parser-history views. Admin pages
  are dynamic and noindex/nofollow; Admin responses deny framing, disable MIME sniffing, and use
  no-referrer.
- Added Admin auth/CSRF/mutation unit coverage, PostgreSQL session and pending-approval integration
  coverage, general-audit verification for Vote revocation, and a desktop/mobile Playwright login +
  pairing-toggle journey.
- Added `docs/ADMIN_CONSOLE.md` and updated README, API, Security, Runbook, environment, and durable
  Codex handoff documentation.

## Validation

| Command/check             | Result | Notes                                                                                                     |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `pnpm lint`               | PASS   | Zero warnings.                                                                                            |
| `pnpm format:check`       | PASS   | Source, tests, and documentation match Prettier.                                                          |
| `pnpm typecheck`          | PASS   | Strict TypeScript `6.0.3`.                                                                                |
| `pnpm test:unit`          | PASS   | 21 files, 75 tests; includes Argon2id/cookie, login limiter/CSRF, and authenticated mutation coverage.    |
| `pnpm test:integration`   | PASS   | 7 files, 27 tests against PostgreSQL 18; includes session lifecycle, pending approval, and dual auditing. |
| `pnpm test:e2e`           | PASS   | 6 tests: Admin + public journeys in desktop/mobile Chromium, one worker.                                  |
| `pnpm build`              | PASS   | Next.js `16.3.0` Webpack build includes dynamic Admin pages and login/logout/mutation APIs.               |
| In-app browser inspection | PASS   | Redirect/login/logout, Pool toggle/restore, desktop/mobile layout, and console inspected; no errors.      |
| Admin response headers    | PASS   | Noindex/nofollow/noarchive, frame denial, no-referrer, nosniff, and request ID observed locally.          |
| `git diff --check`        | PASS   | No whitespace errors.                                                                                     |
| Migration/schema change   | N/A    | M6 uses the reviewed M1 Admin/audit/sync/pending schema and adds no migration.                            |

Docker was kept off during implementation, started only for the final PostgreSQL/browser window on
host port `5433` because local port `5432` was occupied, then the project container was stopped and
Docker Desktop was quit.

## Decisions and corrections made during implementation

- M6 uses one same-origin discriminated mutation endpoint rather than duplicating thin Route
  Handlers for every form. Domain services remain the business-rule boundary; the endpoint only
  validates, authenticates, injects the actor, dispatches, and maps safe errors.
- The initial Admin CLI creation is the unavoidable bootstrap exception to actor-attributed audit:
  no valid actor exists yet. Login, logout, and every later successful mutation are attributed.
- The M1 schema already contained every required Admin/session/audit/sync/pending table, so no
  migration was manufactured merely to mark M6. Optional service input types were widened to accept
  explicit `undefined` from validated HTTP data without changing runtime semantics.
- Broader site-wide response headers remain M8 scope, but private Admin responses receive the narrow
  M6 protections now. Development Next responses use revalidation headers; production dynamic pages
  receive Next's private/no-store policy, while mutation responses explicitly use `no-store`.
- Pending proposals use a documented version-1 action envelope and compare complete expected state
  immediately before application. M7 must emit this contract or introduce a deliberately documented
  and tested next version—never silently replay a different JSON shape.
- Live inspection found wide table min-content sizing expanding the mobile document to 770px. Grid
  children now opt into shrinking and each table scrolls inside its own container; the document was
  rechecked at 390px with no horizontal overflow.
- Argon2 is explicitly approved in pnpm's dependency build policy. This is required for the pinned
  native implementation and is recorded in `pnpm-workspace.yaml` rather than approved implicitly.

## Known limitations

- There is one Admin authority level in the reviewed V0.1 schema. All active Admins can perform all
  console actions; role-based permissions and MFA are not part of M6.
- Login throttling is bounded and process-local. Multi-instance coordination and broader abuse
  enforcement remain M8; correctness never relies on this availability limiter.
- M7 has not run, so the pending queue and sync history are normally empty and development records
  remain fictional. No live HLTV/VRS request was made.
- Pending proposal `expectedState` deliberately uses exact complete-state equality. An adapter must
  regenerate a proposal after any relevant state drift rather than trying to merge automatically.
- The console prioritizes safe complete operator coverage. Final branding and further visual polish
  remain part of the later full-product refinement noted by the owner.

## Next task

Owner Review Gate D: review account provisioning/login/logout, strict session behavior, Team/Player/
Roster/Edition/Event/Pool workflows, pending proposal safety, Vote revocation, dashboard integrity,
audit visibility, and desktop/mobile usability. After explicit approval, begin Milestone 7 provider
adapters and scheduled syncs; do not make live HLTV requests or invent production pool data before
that authorization.
