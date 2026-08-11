# Implementation Progress

## Current position

- **Milestone:** 0 — Repository and runtime foundation
- **Status:** Complete; Owner Review Gate A approved
- **Review boundary:** Gate A passed on 2026-08-11
- **Last updated:** 2026-08-11

## Completed

- Created the pinned Node.js/pnpm/Next.js/TypeScript foundation.
- Added Tailwind, Zod, Drizzle/node-postgres, Pino, Vitest, and Playwright.
- Added strict TypeScript, ESLint, Prettier, and baseline scripts.
- Added local PostgreSQL Compose and a multi-stage non-root production Dockerfile.
- Added lazy database access, environment validation, startup instrumentation, request IDs, and
  structured logging.
- Added liveness/readiness handlers and reusable mutation request guards.
- Added GitHub Actions baseline and documentation/ADR skeleton.
- Added unit tests for configuration, health behavior, mutation guards, and request IDs.
- Made the foundation page explicitly light by default; a user-facing theme switch is deferred to
  the Milestone 5 public UI work.
- Made the local PostgreSQL host port configurable so it can coexist with an existing PostgreSQL
  installation.

## Validation

| Command/check                    | Result | Notes                                                                                                                                        |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PASS   | Clean relink from the committed lockfile with pnpm `11.16.0`.                                                                                |
| `pnpm lint`                      | PASS   | Zero warnings.                                                                                                                               |
| `pnpm format:check`              | PASS   | All included files match Prettier. Pre-existing owner documents are intentionally ignored.                                                   |
| `pnpm typecheck`                 | PASS   | Strict TypeScript `6.0.3`.                                                                                                                   |
| `pnpm test:unit`                 | PASS   | 5 files, 18 tests.                                                                                                                           |
| `pnpm build`                     | PASS   | Next.js `16.3.0` Webpack production build; standalone artifact produced.                                                                     |
| Standalone smoke                 | PASS   | Standalone server rendered `/` and returned `200` from liveness.                                                                             |
| Readiness without PostgreSQL     | PASS   | Returned detail-free `503`; log contains only a safe error code.                                                                             |
| Readiness with PostgreSQL 18.4   | PASS   | Returned `200` against a temporary local PostgreSQL 18.4 server.                                                                             |
| `docker build .`                 | PASS   | Built the pinned multi-stage image successfully as `cs-community-ranking:milestone-0`.                                                       |
| Compose PostgreSQL               | PASS   | PostgreSQL `18.4` became healthy on configurable host port `5433`; the owner's existing PostgreSQL remained untouched on `5432`.             |
| Production image smoke           | PASS   | Non-root (`node`) image returned `200` for `/`, liveness, and database readiness; production placeholder-secret rejection was also verified. |

## Decisions and corrections made during validation

- Pinned TypeScript `6.0.3` rather than `7.0.2`; the TypeScript-ESLint release bundled with the
  current Next.js config explicitly rejects TS 7.
- Pinned ESLint `9.39.5` rather than `10.8.1`; current Next.js React/import/accessibility plugins
  declare ESLint 9 support.
- Production builds use the official Webpack mode because the desktop execution environment blocks
  the internal port used by Turbopack's CSS worker. Development remains on default Turbopack.
- Added pnpm 11's explicit native-build allowlist for `esbuild` and `unrs-resolver`.
- Readiness logs intentionally omit database error messages because they may contain a host/IP.
- These compatibility choices are recorded in `docs/adr/0001-foundation-version-baseline.md`.

## Known limitations

- No domain database schema exists; that is intentionally Milestone 1 work.
- No public voting or Admin route exists.
- External data sync is disabled and unimplemented.
- The foundation page has no theme control; light is the explicit default and the final visual
  system remains Milestone 5 work.

## Next task

Commit and push the approved Milestone 0 foundation. Begin Milestone 1 only when the owner requests
the next implementation phase.
