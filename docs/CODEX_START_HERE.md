# Codex Start Prompt — CS Community Ranking

You are implementing **CS Community Ranking / CS 野榜 V0.1**.

Read `IMPLEMENTATION_PLAN_V0.1.md` in full before modifying the repository. That document is the source of truth.

## Your immediate assignment

Implement **Milestone 0 — Repository and runtime foundation only**.

Do not begin Milestone 1 until the owner reviews Milestone 0.

## Non-negotiable instructions

- Do not change the ranking rule: valid winner `+1`, loser `-1`, Skip `0`.
- Do not add Elo, Bradley–Terry, weighted votes, or recommended pairing.
- Do not change true uniform random pairing.
- Do not require public login.
- Do not add Redis, GraphQL, microservices, a separate backend, Turnstile, or Event MVP.
- Use Node.js 24 LTS, TypeScript, Next.js App Router on Node runtime, PostgreSQL, Drizzle + node-postgres, Zod, Tailwind, Vitest, and Playwright.
- Keep UI/API same-origin.
- Do not run live HLTV requests in tests or CI.
- Do not invent production Candidate Pool data yet.

## Milestone 0 deliverables

1. Initialize the repository and exact pinned toolchain.
2. Configure strict TypeScript, linting, formatting, and pnpm scripts.
3. Add Next.js App Router and Tailwind.
4. Add Drizzle and node-postgres dependencies, but do not implement the full schema yet.
5. Add a local PostgreSQL `docker-compose.yml`.
6. Add a multi-stage production Dockerfile using Node 24 LTS and a non-root runtime user.
7. Add Zod environment validation and an `.env.example` containing no secrets.
8. Add structured logging and request IDs.
9. Add `/api/health/live` and `/api/health/ready`.
10. Add GitHub Actions for install, lint, format check, typecheck, unit test, and production build.
11. Create the `docs/` structure, ADR template, `docs/PROGRESS.md`, and `docs/OPEN_QUESTIONS.md`.
12. Add at least one unit test for configuration validation and one for each health endpoint behavior that can be tested without the later schema.

## Required validation before reporting back

Run and report the exact result of:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm build
docker build .
```

Also start local PostgreSQL and verify readiness changes from unhealthy to healthy when the database becomes available.

## Final response format

Return:

1. Summary of files created/changed.
2. Dependency list with the reason for each non-trivial dependency.
3. Commands run and whether each passed.
4. Any deviation from the plan. There should normally be none.
5. Open questions that genuinely require owner input.
6. A statement that you stopped at Owner Review Gate A.

Update `docs/PROGRESS.md` before finishing.
