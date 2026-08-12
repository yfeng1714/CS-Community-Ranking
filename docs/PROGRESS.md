# Implementation Progress

## Current position

- **Milestone:** 6 — Admin Console and audited operations
- **Status:** Implemented and independently audited at Owner Review Gate D; ready for owner handoff
  before Milestone 7
- **Review boundary:** Milestones 0–6 and the M7 import-approval boundary were reverified across the
  whole repository. External adapters, sync jobs, and live data ingestion have not started.
- **Last updated:** 2026-08-12

## Completed

- Milestones 0–5 remain implemented: pinned runtime/CI foundation, full schema and migrations,
  data-driven Candidate Pool, anonymous visitor identity, atomic uniform-random Ballot issuance,
  exactly-once Vote/ranking transactions, true-refresh-as-Skip, and the responsive public vertical
  slice.
- Milestone 6 provides CLI Admin bootstrap, Argon2id credentials, database-backed opaque sessions,
  strict same-origin Admin mutations, bounded login throttling, responsive private pages, and
  same-transaction audit attribution.
- The Admin Console now covers detailed Team/Player/image editing, external identities, rosters,
  Editions, Events/whitelist/results, Manual Team and Special Player admission, newly signed
  starters from admitted Teams, pairing state, pending-import review, exact Vote lookup/revocation,
  integrity metrics, full audit evidence, and sync/parser history. No UI physically deletes public
  data.
- The pending-import boundary is an exact version-1 discriminated contract. It rejects conflicts,
  incomplete or superseded source runs, type/Edition mismatch, unsupported actions, extra fields,
  and structurally changed current state before applying the ordinary audited domain service under
  the outer review transaction.
- Runtime Pool cache invalidation now follows committed Pool approvals and Player eligibility
  changes. Automatic evidence is tied to the persisted Edition year, placement ranges must be fully
  Top 4/Top 8, and team-derived starters retain their Team admission category.
- Admin JSON/date/ID/database-error handling and trusted-proxy selection were hardened. Dates are
  calendar-exact, browser-local Edition times retain their offset, and public Rating projections
  cannot mix non-HLTV providers.
- CI now starts pinned PostgreSQL, applies migrations, and runs integration tests in addition to the
  static/unit/build gate.
- The independent findings and correction rationale are recorded in
  `docs/IMPLEMENTATION_REVIEW_2026-08-12.md`.

## Validation

| Command/check               | Result | Notes                                                                    |
| --------------------------- | ------ | ------------------------------------------------------------------------ |
| `pnpm lint`                 | PASS   | Zero warnings.                                                           |
| `pnpm format:check`         | PASS   | Source, tests, configuration, and docs match Prettier.                   |
| `pnpm typecheck`            | PASS   | Strict TypeScript `6.0.3`.                                               |
| `pnpm test:unit`            | PASS   | 24 files, 90 tests.                                                      |
| `pnpm test:integration`     | PASS   | 7 files, 31 tests against PostgreSQL 18 and isolated migrated databases. |
| `pnpm test:e2e`             | PASS   | 6 public/Admin journeys in desktop and mobile Chromium.                  |
| `pnpm build`                | PASS   | Optimized Next.js `16.3.0` Webpack build.                                |
| `pnpm db:check`             | PASS   | Drizzle schema and migration journal are consistent.                     |
| `pnpm db:migrate`           | PASS   | Committed migrations apply through the normal runner.                    |
| Production dependency audit | PASS   | No known vulnerability at moderate-or-higher threshold.                  |
| Admin visual inspection     | PASS   | Desktop and 390 px layouts inspected; forms/tables remain contained.     |
| `git diff --check`          | PASS   | No whitespace errors.                                                    |

Docker was kept off for static work, used only for PostgreSQL/browser verification on host port
`5433`, then the project container was stopped and Docker Desktop was quit.

## Material corrections

- Review Gate D exposed genuine implementation gaps rather than a product-decision change. The
  Chronicle remains authoritative and no ranking, randomness, refresh, identity, or history rule
  changed.
- An imported automatically eligible Team now enters as `CORE`/`REVIEW_AUTO`, never as
  `REVIEW_MANUAL`; an imported team-derived starter inherits that Team category, never `SPECIAL`.
- `expectedState` is compared structurally after canonical JSON conversion and updates are resolved
  by their internal IDs. External provider keys remain proposal metadata, not database identity.
- Player professional-status updates clear all in-process active-Pool snapshots after commit. DB
  revalidation remains the final Ballot safety boundary, including across multiple app instances.
- Public Rating fields are explicitly HLTV-owned. M7 may store other provider metrics, but it must
  not present them under the HLTV label.
- No migration was manufactured for this review because the existing schema already supports the
  corrected workflows.

## Known limitations

- M7 has not run: provider adapters, snapshot writers, import proposal generators, scheduled job
  commands, attribution/assets, and real freshness data do not exist yet. No live HLTV/VRS request
  was made.
- There is one Admin authority level. Roles, MFA, distributed login throttling, IP-risk processing,
  analytics, retention jobs, and broader response-header work remain outside M6.
- Pending expected-state equality is deliberately exact. State drift requires a regenerated
  proposal; the review service never merges provider changes automatically.
- Pool cache invalidation is process-local. Other instances can retain a snapshot only until the
  short TTL, while Ballot issuance always revalidates selected rows in PostgreSQL before use.
- Final public/Admin visual polish remains a later refinement; the current UI prioritizes complete,
  safe operator coverage.

## Next task

Wait for the owner's review of this independent gate and explicit instruction before starting
Milestone 7. Then implement fixture-tested Valve VRS and narrow HLTV adapters, sync history,
approved snapshot writes, attribution/freshness, and reviewable Candidate Pool proposals. Do not
make live provider requests in tests/CI and do not make any imported change live automatically.
