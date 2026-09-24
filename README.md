# CS 野榜 / CS Community Ranking

English · [简体中文](README.zh-CN.md)

> Two players. Pick one. Or skip.

CS 野榜 is a community vote on professional Counter-Strike players. Each choice
helps shape a season ranking. The result reflects this community's votes, not
an objective measure of player skill.

## What you can do

- **Vote:** See a random pair of eligible players, choose one, or skip. A
  counted vote gives the chosen player **+1** and the other player **−1**;
  skipping changes neither score. Refreshing an unresolved pair counts as a
  skip and presents another pair.
- **Explore the ranking:** Search players, compare their community scores, and
  open player pages for team, win/loss/skip totals, and available stats.
- **Vote for Event MVP:** A separate event ballot lets each visitor support one
  player per Shanghai calendar day with **+1**. It does not change the season
  ranking. Past events remain available as read-only results.

Voting is anonymous and does not require an account. The candidate pool is
curated from reviewed roster and ranking evidence; new players are not admitted
automatically. Player stats and event data come from reviewed snapshots and may
be older than the latest source pages.

## Availability

As of 2026-09-24, the public beta has ended and the website is intentionally
offline while feedback is collected. There is no live public demo at present.
The project can still be run locally.

## Run locally

You need Node.js `24.14.0`, pnpm `11.16.0`, and Docker.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The local seed uses
fictional development data; it does not copy the former beta's database or
Event MVP snapshots. To create a local Admin, run
`pnpm admin:create -- --username=owner`; the CLI prompts for a password.

If port `5432` is occupied, set `POSTGRES_PORT` and the matching
`DATABASE_URL` in `.env`. Stop the database with
`docker compose stop postgres`. On macOS, quit Docker Desktop when it is no
longer needed to release its CPU and memory.

## Project documentation

- [Product Decision Chronicle](docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md)
  explains the product choices.
- [Public UI](docs/PUBLIC_UI.md), [Candidate Pool](docs/CANDIDATE_POOL.md),
  and [Event MVP](docs/EVENT_MVP.md) describe the visible features and rules.
- [Implementation progress](docs/PROGRESS.md) and
  [current limitations](docs/CURRENT_LIMITATIONS.md) record the beta's
  implementation and known gaps.
- [Runbook](docs/RUNBOOK.md) covers setup, data imports, operations, and
  backups. Available commands are defined in [package.json](package.json).
- [Image sourcing](docs/IMAGE_SOURCING.md) records the asset review process.

When documents disagree about product intent, use the Product Decision
Chronicle and record important changes.

## Technical summary

The app uses Next.js, React, TypeScript, PostgreSQL, Drizzle ORM, and Tailwind
CSS. Vitest and Playwright cover tests. Automated HLTV retrieval remains
disabled after HTTP 403 responses; reviewed local capture and import are the
current fallback. The historical public launch and Railway backup setup are
documented in [Gate F](docs/LAUNCH_GATE_F.md) and the
[runbook](docs/RUNBOOK.md).

## License and assets

The project's original source code and documentation are available under the
[MIT License](LICENSE). This license does **not** grant rights to player
portraits, photographs, team logos, trademarks, or externally sourced data.
Some images in this repository were accepted for provisional beta use and do
not have confirmed reuse rights; see [image sourcing](docs/IMAGE_SOURCING.md)
and [asset records](assets/README.md). Vendored country flags retain their
[own MIT notice](public/flags/LICENSE).
