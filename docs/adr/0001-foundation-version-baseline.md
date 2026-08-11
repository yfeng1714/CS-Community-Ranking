# ADR 0001: Foundation version baseline

- **Status:** Accepted for Milestone 0 review
- **Date:** 2026-08-10
- **Owners:** Project owner and implementation reviewer

## Context

The Implementation Plan freezes Node.js 24 LTS, TypeScript, Next.js App Router, PostgreSQL,
Drizzle, Tailwind, Vitest, and Playwright, but intentionally leaves exact package and PostgreSQL
versions to implementation. Reproducible local, CI, and Docker behavior requires exact pins.

## Decision

- Pin Node.js `24.14.0` in `.node-version`, `.nvmrc`, `package.json`, CI, and Docker.
- Pin pnpm `11.16.0` in `package.json`, CI, and Docker.
- Start with Next.js `16.3.0`, React `19.2.8`, and TypeScript `6.0.3`.
- Use PostgreSQL `18.4` locally through the official `postgres:18.4-alpine3.24` image.
- Use Next.js Webpack for production builds while retaining the default Turbopack development
  server. The build command is `next build --webpack` in local, CI, and Docker environments.
- Pin all direct dependencies exactly and commit `pnpm-lock.yaml`.
- Upgrade patches deliberately through reviewed dependency pull requests; do not use floating
  `latest` tags in application or database runtime configuration.

## Alternatives considered

- Floating major/minor tags were rejected because they undermine reproducible Gate reviews.
- Node.js 26 was rejected because it is Current rather than LTS on the decision date.
- TypeScript 7.0 was rejected at Gate A because the TypeScript-ESLint version used by Next.js
  `16.3.0` does not support the TS 7 compiler API yet; the latest compatible 6.x release is pinned.
- ESLint 10 was rejected because the React/import/accessibility plugins bundled by the current
  Next.js config declare ESLint 9 support; the latest compatible 9.x release is pinned.
- An older PostgreSQL major was unnecessary before production data exists; PostgreSQL 18 is the
  current supported release and provides the full transaction/index behavior required by the plan.
- The default Turbopack production build was rejected at Gate A because its CSS worker binds an
  internal port that is prohibited in the owner/Codex desktop execution environment. Webpack is an
  official Next.js build mode and avoids an environment-specific, non-product failure.

## Consequences

Exact pins improve reproducibility and make upgrades visible. They also require intentional patch
maintenance, especially for security releases. Railway production PostgreSQL compatibility must be
confirmed again at Milestone 9 before production data is created.

## Validation

Gate A validates install, lint, format, typecheck, unit tests, production build, and Docker build.
Gate B validates PostgreSQL-specific migrations and constraints against the selected major version.
