# Implementation Progress

## Current position

- **Milestone:** 5 — Public vertical slice
- **Status:** Implemented; awaiting owner review before Milestone 6
- **Review boundary:** Public Vote/Ranking/Player/About/Privacy journey is complete; implementation
  stops before Admin authentication and mutation surfaces
- **Last updated:** 2026-08-12

## Completed

- Replaced the placeholder home page with a responsive Vote experience that uses the M3/M4 APIs,
  shows complete two-player cards, supports details and keyboard shortcuts, reports counted versus
  non-counting outcomes honestly, keeps results in place, and advances only through explicit Next.
- Completed the browser half of ADR 0003. A true manual Vote-page reload skips only a confirmed
  reused open Ballot, then displays the replacement directly. A session marker makes lost-response
  recovery idempotent without ever skipping a newly issued replacement.
- Added public Ranking and Player projections over the active Edition, current roster, rankings, and
  latest approved stats. Ranking uses competition ties with deterministic equal-score display order;
  unsafe bigint-to-number conversion fails closed.
- Added `GET /api/v1/rankings` and `GET /api/v1/players/{slug}` with validation, short public cache
  policies, no-store errors, safe not-found behavior, and detail-free unexpected failures.
- Added Ranking search and responsive prioritization, Player profile/record/stats pages, About,
  Privacy, public loading/error/not-found states, a shared header/footer, local monogram image
  fallbacks, and accessible inline icons.
- Made light mode deterministic on first visit, independent of system theme, and added an explicit
  persisted light/dark toggle. The stored theme is separate from anonymous voting identity.
- Added explicit current/missing/stale presentation. Approved snapshots become stale after 48 hours;
  missing data renders as `—` or an explanatory label and never as a fabricated zero.
- Added visible focus styles, skip-to-content, semantic table/button structure, result focus/live
  handling, keyboard controls, reduced-motion behavior, and desktop/mobile layouts.
- Added focused unit tests for reload recovery, public presentation, and public handlers; PostgreSQL
  integration tests for public ordering/profile data; and a serial, resource-conscious Playwright
  journey in desktop and mobile Chromium.
- Added `docs/PUBLIC_UI.md` and updated README, API, runbook, open questions, and durable Codex
  handoff documentation.

## Validation

| Command/check             | Result | Notes                                                                                                |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `pnpm lint`               | PASS   | Zero warnings.                                                                                       |
| `pnpm format:check`       | PASS   | Source, tests, and documentation match Prettier.                                                     |
| `pnpm typecheck`          | PASS   | Strict TypeScript `6.0.3`.                                                                           |
| `pnpm test:unit`          | PASS   | 18 files, 66 tests; includes reload/retry, freshness/counter, and public handler coverage.           |
| `pnpm test:integration`   | PASS   | 5 files, 23 tests against PostgreSQL 18; adds public ranking ties/order and profile/stat projection. |
| `pnpm test:e2e`           | PASS   | 4 tests: complete public journey in desktop and mobile Chromium, one worker.                         |
| `pnpm build`              | PASS   | Next.js `16.3.0` Webpack production build includes all public pages and read APIs.                   |
| In-app browser inspection | PASS   | Desktop/mobile Vote and mobile Ranking inspected; no console errors.                                 |
| `git diff --check`        | PASS   | No whitespace errors.                                                                                |
| Migration/schema change   | N/A    | M5 uses the reviewed M1 schema and adds no migration.                                                |

## Decisions and corrections made during implementation

- The working UI identity is `CS 野榜`; final product name, domain, slogan, and visual identity remain
  a pre-launch owner decision. M5 does not freeze temporary branding.
- First visit is deliberately light even when the operating system prefers dark. A user-selected
  dark theme persists in local storage, satisfying the owner's M0 UI note without coupling display
  preference to the anonymous visitor cookie.
- Stats older than 48 hours are presented as stale. This is a conservative M5 display threshold,
  recorded in `docs/PUBLIC_UI.md`, and can become provider-specific when M7 implements adapters.
- Server-rendered public pages and JSON read endpoints share domain query functions instead of
  fetching the app's own HTTP endpoints. This avoids an internal network hop and keeps one public
  projection contract.
- The Ranking mobile view was corrected after live visual inspection to prioritize rank, player, and
  community score. Desktop retains team and full win/loss/rate/decision columns.
- Owner review exposed a development-overlay hydration warning caused by a grammar browser extension
  injecting attributes directly onto `<body>` before React loaded. The root layout now suppresses
  hydration warnings only at that direct element boundary; application subtree mismatches remain
  visible and actionable.
- Playwright runs with one local worker so desktop and mobile coverage does not create avoidable CPU
  pressure. Docker remained off during coding/static validation and was used only for the final
  PostgreSQL/browser window.

## Known limitations

- Development data is fictional and intentionally has no imported photos or external stat snapshots;
  M5 demonstrates its deliberate missing-data fallbacks. Approved VRS/HLTV ingestion begins in M7.
- `CS 野榜` and the current visual system are working choices, not launch-approved branding.
- The Privacy contact/takedown address and final legal text remain explicit launch blockers.
- M5 has no authenticated Admin surface. Pool/roster changes still use trusted services and CLIs;
  Admin authentication, authorization, CRUD, approvals, and audit UI belong to M6.
- Public read caching is short process/platform HTTP caching only. No Redis or external cache was
  added.
- The 48-hour stale threshold is global until M7 supplies provider-specific operating knowledge.

## Next task

Owner review of the M5 desktop/mobile public journey, result disclosure, reload-as-Skip behavior,
ranking ties/search, Player/About/Privacy content, light-default theme, and missing/stale states.
After explicit approval, begin Milestone 6: authenticated Admin/session management, audited
Team/Player/Roster/Edition/Event/Pool mutations, pending-change approval, Vote revocation UI, and
integrity/sync visibility.
