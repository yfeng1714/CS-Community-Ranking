# CS Community Ranking / CS 野榜

Community-generated rankings for professional Counter-Strike players, built from
simple pairwise votes.

## Status

Milestones 0–8 are implemented: the runtime foundation, full V0.1 database schema, data-driven
Candidate Pool, secure anonymous visitor identity, atomic random Ballot issuance, exactly-once
Vote/ranking transactions, and the responsive public Vote/Ranking/Player vertical slice are in
place, together with the authenticated Admin Console, fixture-tested VRS/HLTV adapters, external
snapshot approval, freshness, and review-only Candidate Pool drafts. Gate D remains the governing
import boundary: no provider result becomes a live Pool change automatically. M8 adds daily
privacy-preserving network risk keys, observe/enforce risk collection, first-party analytics/KPIs,
integrity and retention jobs, bounded public API protection, and site-wide security headers.

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
| `pnpm job:integrity-check -- --edition <code>` | Check ranking, Pool, Vote, aggregate, and risk-key integrity |
| `pnpm job:expire-ballots [-- --batch <count>]` | Batch-expire overdue open Ballots |
| `pnpm job:retention-cleanup` | Apply configured analytics and IP-risk-key retention |

## Documentation

- [`docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md`](docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md) — product intent and decision history
- [`docs/IMPLEMENTATION_PLAN_V0.1.md`](docs/IMPLEMENTATION_PLAN_V0.1.md) — milestone implementation plan
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — current implementation status
- [`docs/IMPLEMENTATION_REVIEW_2026-08-12.md`](docs/IMPLEMENTATION_REVIEW_2026-08-12.md) — independent Gate D findings, corrections, and verification evidence
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — development and operational procedures
- [`docs/API.md`](docs/API.md) — API conventions
- [`docs/DATABASE.md`](docs/DATABASE.md) — database conventions
- [`docs/CANDIDATE_POOL.md`](docs/CANDIDATE_POOL.md) — Candidate Pool rules, services, cache, and CLI
- [`docs/BALLOT_ISSUANCE.md`](docs/BALLOT_ISSUANCE.md) — visitor identity, quota, random pairing, and issuance transaction
- [`docs/VOTE_RESOLUTION.md`](docs/VOTE_RESOLUTION.md) — exactly-once resolution, ranking, revocation, and integrity checks
- [`docs/PUBLIC_UI.md`](docs/PUBLIC_UI.md) — public pages, display rules, reload orchestration, and accessibility
- [`docs/ADMIN_CONSOLE.md`](docs/ADMIN_CONSOLE.md) — Admin sessions, mutation/audit workflows, and pending-review safety
- [`docs/SECURITY.md`](docs/SECURITY.md) — security baseline

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
