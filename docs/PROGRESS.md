# Implementation Progress

## Current position

- **Milestone:** 1 — Database schema and invariants
- **Status:** Complete; Owner Review Gate B approved
- **Review boundary:** Gate B passed on 2026-08-11
- **Last updated:** 2026-08-11

## Completed

- Added the complete V0.1 PostgreSQL model: 27 tables and 21 enums spanning catalog, editions,
  pools, ballots, votes, aggregates, snapshots, administration, sync, and staged imports.
- Added the reviewed initial Drizzle migration and metadata snapshot.
- Enforced database-owned invariants with foreign keys, check constraints, unique constraints, and
  partial unique indexes, including one active edition, one current roster membership, one open
  ballot per visitor and edition, and one vote per ballot.
- Added canonical pair orientation, lifecycle-shape, counter, score, and import-state constraints.
- Typed the shared Drizzle client with the full schema and retained bounded PostgreSQL pooling.
- Added explicit migration and seed entry points plus schema drift checking.
- Added an idempotent, development-only fictional seed with a disabled administrator account.
- Added an isolated integration-test lifecycle using the fixed `csr_m1_test` database; setup starts
  from an empty database and teardown force-drops only that database.
- Added 11 real-PostgreSQL integration tests covering schema inventory, critical constraints,
  duplicate rejection, lifecycle rules, and seed idempotency.
- Documented the database model, operational commands, invariant ownership boundary, and rationale
  in `docs/DATABASE.md`, `docs/RUNBOOK.md`, and ADR 0002.

## Validation

| Command/check                    | Result | Notes                                                                              |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PASS   | Lockfile remained reproducible with pnpm `11.16.0`.                                |
| `pnpm db:check`                  | PASS   | Drizzle migration metadata and schema are valid.                                   |
| `pnpm db:migrate`                | PASS   | Initial migration applies from empty and is idempotent when rerun.                 |
| `pnpm db:seed`                   | PASS   | Fictional development seed is idempotent when rerun.                               |
| Schema drift generation          | PASS   | Drizzle reports no changes after the reviewed migration.                           |
| `pnpm lint`                      | PASS   | Zero warnings.                                                                     |
| `pnpm format:check`              | PASS   | All included files match Prettier.                                                 |
| `pnpm typecheck`                 | PASS   | Strict TypeScript `6.0.3`.                                                         |
| `pnpm test:unit`                 | PASS   | 5 files, 18 tests.                                                                 |
| `pnpm test:integration`          | PASS   | 1 file, 11 tests against local PostgreSQL 18.                                      |
| `pnpm test:e2e`                  | PASS   | Playwright is configured; no browser scenarios are expected before public UI work. |
| `pnpm build`                     | PASS   | Next.js `16.3.0` Webpack production build.                                         |
| Development database inspection  | PASS   | 27 tables, one migration record, 2 fictional teams, and 4 fictional players.       |
| `docker build .`                 | PASS   | Built `cs-community-ranking:milestone-1`.                                          |
| Production image smoke           | PASS   | Non-root (`node`) image returned `200` for `/`, liveness, and database readiness.  |

## Decisions and corrections made during validation

- Database constraints own row-local and indexable invariants; cross-row and workflow invariants
  that require locking or multi-step reads remain service-layer responsibilities. ADR 0002 records
  the boundary.
- PostgreSQL `bigint` values map to JavaScript `bigint` so counters are not silently narrowed.
- Bigint zero defaults use SQL literals because Drizzle Kit cannot serialize JavaScript `0n` in
  migration snapshots; the generated database type and default remain `bigint` and `0`.
- Seed data is deliberately fictional and the seeded administrator is disabled with an unusable
  placeholder hash, preventing development convenience from creating a working credential.
- The integration harness creates and drops only the explicit `csr_m1_test` database. It never
  derives a destructive target from the normal application database URL.
- The V0.1 model is an evolvable baseline rather than a frozen final schema. Future features and
  operational learning will be handled through reviewed, ordered forward migrations with upgrade
  coverage.

## Known limitations

- Domain services and the vote transaction are intentionally not implemented; they begin after
  Gate B in Milestone 2.
- Cross-table rules such as edition/pool consistency and transaction-wide aggregate maintenance
  require the later service layer and locking strategy.
- V0.1 recovery remains forward migration plus empty-database rebuild; production rollback and
  backup procedures are deployment-stage work.
- Playwright has no browser scenarios yet because the public product UI is a later milestone.

## Next task

Begin Milestone 2: implement the transactional ballot-selection and voting service, including
locking, idempotency, quotas, expiration, and aggregate maintenance.
