# CS Community Ranking / CS 野榜

Community-generated rankings for professional Counter-Strike players, built from
simple pairwise votes.

## Status

Milestones 0–3 are implemented: the runtime foundation, full V0.1 database schema, data-driven
Candidate Pool, secure anonymous visitor identity, and atomic random Ballot issuance are in place.
Vote resolution and exactly-once ranking effects begin in Milestone 4.

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
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Health endpoints:

- [http://localhost:3000/api/health/live](http://localhost:3000/api/health/live)
- [http://localhost:3000/api/health/ready](http://localhost:3000/api/health/ready)

After `pnpm db:migrate && pnpm db:seed`, request a development Ballot from the browser console:

```js
await fetch("/api/v1/ballots/next", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
}).then((response) => response.json());
```

The fictional seed activates its Edition only when no other Edition is active. Until Milestone 4,
repeated requests correctly return the same unexpired Ballot because it cannot yet be resolved.
After M4/M5, a true manual voting-page refresh will resolve that reused Ballot as Skip and immediately
show a new pair; ordinary API retries will continue to reuse it safely.

Stop the local database with `docker compose down`.

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
| `pnpm pool:add-player -- ...` | Create and admit an individual Special player |
| `pnpm pool:disable-player -- ...` | Disable future pairing without deleting history |

## Documentation

- [`docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md`](docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md) — product intent and decision history
- [`docs/IMPLEMENTATION_PLAN_V0.1.md`](docs/IMPLEMENTATION_PLAN_V0.1.md) — milestone implementation plan
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — current implementation status
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — development and operational procedures
- [`docs/API.md`](docs/API.md) — API conventions
- [`docs/DATABASE.md`](docs/DATABASE.md) — database conventions
- [`docs/CANDIDATE_POOL.md`](docs/CANDIDATE_POOL.md) — Candidate Pool rules, services, cache, and CLI
- [`docs/BALLOT_ISSUANCE.md`](docs/BALLOT_ISSUANCE.md) — visitor identity, quota, random pairing, and issuance transaction
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
