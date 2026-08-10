# CS Community Ranking / CS 野榜

Community ranking for Counter-Strike pros: pairwise votes, simple score updates, no login required.

## Status

Early foundation. See `docs/` for product decisions and the implementation plan.

## Stack (planned)

- Node.js 24 LTS
- TypeScript
- Next.js (App Router)
- PostgreSQL
- Drizzle ORM
- Tailwind CSS
- Vitest + Playwright

## Getting started

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Start local PostgreSQL
docker compose up -d

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start Next.js in development |
| `pnpm build` | Production build |
| `pnpm lint` | Lint |
| `pnpm format:check` | Check formatting |
| `pnpm typecheck` | TypeScript check |
| `pnpm test:unit` | Unit tests |
| `pnpm test:e2e` | End-to-end tests |

## Docs

- [`docs/CODEX_START_HERE.md`](docs/CODEX_START_HERE.md) — implementation kickoff
- [`docs/IMPLEMENTATION_PLAN_V0.1.md`](docs/IMPLEMENTATION_PLAN_V0.1.md) — source of truth for V0.1
- [`docs/REVIEW_SUMMARY_ZH.md`](docs/REVIEW_SUMMARY_ZH.md) — Chinese owner review summary
- [`docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md`](docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md) — product decision chronicle

## Ranking rules (frozen)

- Valid vote: winner `+1`, loser `-1`
- Skip: both `0`
- True uniform random pairing from the active candidate pool
- No Elo, Bradley–Terry, or weighted votes
- No public login required

## License

TBD
