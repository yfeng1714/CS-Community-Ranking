# CS Community Ranking / CS 野榜

Community-generated rankings for professional Counter-Strike players, built from
simple pairwise votes.

## Status

Milestones 0–9 are implemented and Owner Review Gate E was approved on 2026-08-14. M10 is now in
review-only preparation: a fail-closed launch-readiness command, an Owner-approved 14-Team/70-Player
canonical manifest, and Gate F evidence checklist are in place. An isolated local rehearsal has
applied that manifest and admitted the Owner-approved, conflict-free 14-Team/70-Player Core Pool
from approved August 3 VRS and August 10 HLTV evidence. Its pre-asset DRAFT launch-readiness report
passes with only placeholder-image and optional-stat warnings. The repository now also contains the
complete locally served and attributed 14-Team-logo/70-Player-portrait set.
A separate local-only clone is ACTIVE for UI
preview; the canonical rehearsal remains DRAFT and zeroed. No Railway reset, production Pool,
production Edition activation, or closed beta has started. ADR 0006 selects a one-time
in-place reset of the fictional Railway database after final verified backup evidence, so the launch
plan keeps one Railway PostgreSQL service. The runtime foundation, full V0.1 database schema, data-driven
Candidate Pool, secure anonymous visitor identity, atomic random Ballot issuance, exactly-once
Vote/ranking transactions, and the responsive public Vote/Ranking/Player vertical slice are in
place, together with the authenticated Admin Console, fixture-tested VRS/HLTV adapters, external
snapshot approval, freshness, and review-only Candidate Pool drafts. Gate D remains the governing
import boundary: no provider result becomes a live Pool change automatically. M8 adds daily
privacy-preserving network risk keys, observe/enforce risk collection, first-party analytics/KPIs,
integrity and retention jobs, bounded public API protection, and site-wide security headers. The
production image, migration-gated Railway topology, scheduled-service configs, staging smoke/load,
and backup/restore verification are versioned. Direct Railway staging is live; the first retained
local logical backup has passed a full 14-table restore and has a verified independent copy in a
private Cloudflare R2 bucket. The M10 next boundary is real-data rehearsal, final in-place-reset
evidence/approval, and Owner review under `docs/LAUNCH_GATE_F.md`.

Players may carry an optional validated HLTV profile URL for human reference. It is managed through
the audited Admin flow and shown on the public Player page, while external provider identities
remain separate synchronization records.

The small community beta intentionally has no public privacy/contact page. Existing data-minimizing
cookie, IP-risk-key, and retention safeguards remain in place; a dedicated policy/contact surface
will be reconsidered when the product has a custom domain or materially broader use. Real images may
be imported for the beta under explicit Owner acceptance. Minimal path/review state is tracked while
exact source records remain Git/Docker-ignored local Dev/Ops evidence. See `docs/IMAGE_SOURCING.md`.

## Technology

- Node.js 24 LTS and TypeScript
- Next.js App Router and React
- PostgreSQL and Drizzle ORM
- Tailwind CSS
- Vitest and Playwright

Exact runtime and dependency versions are pinned in the repository.

## Getting started

Prerequisites: Node.js `24.14.0`, pnpm `11.16.0`, and Docker.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Create an Admin with `pnpm admin:create -- --username=owner`, then open
[http://localhost:3000/admin](http://localhost:3000/admin). The CLI prompts for a hidden password;
there is no web registration.

Health endpoints:

- [http://localhost:3000/api/health/live](http://localhost:3000/api/health/live)
- [http://localhost:3000/api/health/ready](http://localhost:3000/api/health/ready)

External sync jobs are deliberately separate from web requests. See `docs/DATA_SOURCES.md` before
enabling HLTV or running `job:sync-vrs`, `job:sync-hltv`, or `job:build-pool-draft`.

The fictional seed activates its Edition only when no other Edition is active. Use `/` to vote,
`/ranking` to search the current community ranking, and a ranking-row link to open a Player page.
The interface defaults to light mode and provides a persisted theme toggle. A true manual reload of
the Vote page records the still-open Ballot as Skip and immediately shows the next Ballot; ordinary
renders and API retries preserve it.

Stop the local database with `docker compose stop postgres`. On macOS, quit Docker Desktop afterward
when no other project needs it so the Docker VM releases its CPU and memory. The named PostgreSQL
volume remains available for the next start.

If port `5432` is already occupied, set `POSTGRES_PORT` to another host port in
`.env` and use the same port in `DATABASE_URL`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm format:check` | Check formatting |
| `pnpm typecheck` | Check TypeScript |
| `pnpm test:unit` | Run unit tests |
| `pnpm test:integration` | Run integration tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm db:migrate` | Apply committed PostgreSQL migrations |
| `pnpm db:seed` | Load repeatable fictional development data |
| `pnpm db:check` | Check the Drizzle migration journal |
| `pnpm admin:create -- --username=<name>` | Create an active Admin with a hidden Argon2id password prompt |
| `pnpm pool:add-player -- ...` | Create and admit an individual Special player |
| `pnpm pool:disable-player -- ...` | Disable future pairing without deleting history |
| `pnpm score:check -- --edition <code>` | Verify zero-sum and Vote/ranking/aggregate integrity |
| `pnpm report:kpi -- --edition <code> [--date YYYY-MM-DD]` | Generate the first-party daily KPI report |
| `pnpm launch:check -- --edition <code>` | Produce the fail-closed, read-only pre-activation readiness report |
| `pnpm canonical:bootstrap [-- ...]` | Validate the DRAFT canonical manifest; explicit approved flags are required to apply it to an empty DB |
| `pnpm assets:import-hltv-portraits -- --capture <file> --bundles <dir,...>` | Identity-check and import reviewed local HLTV portrait bundles |
| `pnpm source:approve-ranking -- --snapshot <id> [...]` | Review an immutable ranking snapshot; explicit actor, reason, apply, and confirmation inputs are required to approve it |
| `pnpm source:import-reviewed-hltv [-- ...]` | Validate the checksum-locked reviewed HLTV top-12 fallback; guarded apply records and approves it when live retrieval is blocked |
| `pnpm source:capture-reviewed-hltv-stats [-- ...]` | Local Playwright capture of official HLTV player profiles into the ignored reviewed-stats JSON; see `docs/HLTV_PLAYER_STATS.md` |
| `pnpm source:preview-reviewed-hltv-stats [-- ...]` | Write a local HTML table of a captured reviewed-stats JSON for Owner spot-check |
| `pnpm job:build-pool-draft -- --edition <code>` | Build review-only Pool proposals from the latest approved HLTV/VRS snapshots |
| `pnpm pending:review -- --id <id>[,<id>...] [...]` | Preview exact pending proposals; guarded apply reviews each through the ordinary audited Gate D service |
| `pnpm job:integrity-check -- --edition <code>` | Check ranking, Pool, Vote, aggregate, and risk-key integrity |
| `pnpm job:expire-ballots [-- --batch <count>]` | Batch-expire overdue open Ballots |
| `pnpm job:retention-cleanup` | Apply configured analytics and IP-risk-key retention |
| `pnpm ops:smoke -- --origin <https-origin>` | Verify staging health, public routes, payloads, and security headers |
| `pnpm ops:load -- --origin <https-origin> --confirm-staging` | Run a bounded, SKIP-only staging concurrency scenario |
| `pnpm backup:create -- --output <file.dump>` | Create a portable PostgreSQL dump plus row-count manifest |
| `pnpm backup:verify -- --dump <file.dump>` | Restore into a separate empty DB and verify critical-table counts |

## Documentation

- [`docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md`](docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md) — product intent and decision history
- [`docs/IMPLEMENTATION_PLAN_V0.1.md`](docs/IMPLEMENTATION_PLAN_V0.1.md) — milestone implementation plan
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — current implementation status
- [`docs/IMPLEMENTATION_REVIEW_2026-08-12.md`](docs/IMPLEMENTATION_REVIEW_2026-08-12.md) — independent Gate D findings, corrections, and verification evidence
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — development and operational procedures
- [`docs/API.md`](docs/API.md) — API conventions
- [`docs/DATABASE.md`](docs/DATABASE.md) — database conventions
- [`docs/CANDIDATE_POOL.md`](docs/CANDIDATE_POOL.md) — Candidate Pool rules, services, cache, and CLI
- [`docs/CANONICAL_BOOTSTRAP.md`](docs/CANONICAL_BOOTSTRAP.md) — fail-closed real-data manifest review and empty-DB bootstrap boundary
- [`docs/CANONICAL_DATA_REVIEW_2026-08-14.md`](docs/CANONICAL_DATA_REVIEW_2026-08-14.md) — proposed 14-Team roster sheet, source conflicts, and Owner review record
- [`docs/BALLOT_ISSUANCE.md`](docs/BALLOT_ISSUANCE.md) — visitor identity, quota, random pairing, and issuance transaction
- [`docs/VOTE_RESOLUTION.md`](docs/VOTE_RESOLUTION.md) — exactly-once resolution, ranking, revocation, and integrity checks
- [`docs/PUBLIC_UI.md`](docs/PUBLIC_UI.md) — public pages, display rules, reload orchestration, and accessibility
- [`docs/IMAGE_SOURCING.md`](docs/IMAGE_SOURCING.md) — image source priorities, provisional-rights status, and local import workflow
- [`docs/ADMIN_CONSOLE.md`](docs/ADMIN_CONSOLE.md) — Admin sessions, mutation/audit workflows, and pending-review safety
- [`docs/SECURITY.md`](docs/SECURITY.md) — security baseline
- [`docs/STAGING_GATE_E.md`](docs/STAGING_GATE_E.md) — staging evidence checklist and Owner Review Gate E
- [`docs/LAUNCH_GATE_F.md`](docs/LAUNCH_GATE_F.md) — M10 production Pool, closed-beta, and launch sign-off record

When documents disagree about product intent, use the Product Decision Chronicle
as the primary reference and record important changes.

## Core ranking rules

- A valid vote gives the winner `+1` and the loser `-1`.
- A skip changes neither score.
- Pairing is uniformly random across the active candidate pool.
- The first version has no Elo, Bradley–Terry model, weighted votes, or required
  public login.

## License

To be determined.
