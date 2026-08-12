# Implementation Progress

## Current position

- **Milestone:** 7 — External data adapters and scheduled jobs
- **Status:** Implemented and verified; ready for owner review before Milestone 8
- **Review boundary:** VRS/HLTV adapters, source snapshots/approval, freshness/stale fallback,
  review-only Pool drafts, commands, daily ranking snapshots, and asset attribution are complete.
  No production sync was run.
- **Last updated:** 2026-08-12

## Completed

- Official-repository Valve VRS Markdown and narrow HLTV HTML adapters normalize only approved
  ranking and Rating fields. Saved fixtures cover expected fields and parser drift; CI makes no live
  provider request.
- Provider fetches enforce HTTPS/source boundaries, content type, a 5 MiB cap, timeout, bounded
  retry/backoff, single-request sequencing, configured HLTV delay/User-Agent, and a host circuit
  breaker. Failures close `sync_run` and preserve stale database data.
- Ranking syncs store immutable normalized snapshots with parser version, freshness, and SHA-256
  checksum. Admin explicitly approves each source with an audit before Pool generation consumes it.
- Pool draft generation reads only latest approved HLTV/VRS snapshots, verifies formal rosters,
  emits stale/identity/roster conflicts, reports would-be removals, and writes only Gate-D `PENDING`
  additions. It never changes or removes live Pool membership automatically.
- One-shot commands cover VRS sync, HLTV ranking/player-stat sync, Pool draft generation, and
  idempotent tied daily ranking snapshots. The local asset manifest/check prohibits hotlinking and
  requires rights notes.

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
| `pnpm test:unit`            | PASS   | 27 files, 98 tests.                                                      |
| `pnpm test:integration`     | PASS   | 8 files, 35 tests against PostgreSQL 18 and isolated migrated databases. |
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

- No production provider sync or real Candidate Pool draft was run. HLTV remains disabled by
  default, and its replaceable parser fails closed when upstream markup changes.
- VRS Team matching primarily uses normalized Team name because Valve's table exposes no stable
  organization ID. Ambiguous/missing matches are review conflicts and are never guessed.
- Scheduled-service configuration belongs to deployment in M9; M7 supplies one-shot commands.
- There is one Admin authority level. Roles, MFA, distributed login throttling, IP-risk processing,
  analytics, retention jobs, and broader response-header work remain outside M6.
- Pending expected-state equality is deliberately exact. State drift requires a regenerated
  proposal; the review service never merges provider changes automatically.
- Pool cache invalidation is process-local. Other instances can retain a snapshot only until the
  short TTL, while Ballot issuance always revalidates selected rows in PostgreSQL before use.
- Final public/Admin visual polish remains a later refinement; the current UI prioritizes complete,
  safe operator coverage.

## Next task

Wait for owner review and explicit instruction before Milestone 8. Then implement observe-mode
anti-abuse risk keys, product analytics/KPI queries, broader integrity and retention jobs, and
security hardening. Deployment and production cloud-database selection remain Milestone 9.
