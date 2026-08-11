# ADR 0002: V0.1 schema and invariant boundary

- **Status:** Proposed for Owner Review Gate B
- **Date:** 2026-08-11
- **Owners:** Project owner and implementation reviewer

## Context

Milestone 1 turns the V0.1 persistence proposal into executable PostgreSQL constraints. The model
must protect vote idempotency, score integrity, Edition and roster uniqueness, historical audit
records, and import review state before transaction services are built.

Some rules are local to one row or unique key and belong in PostgreSQL. Other rules compare data
across tables or represent a multi-row state transition; PostgreSQL `CHECK` constraints cannot
safely enforce those without triggers that would duplicate future service logic.

## Decision

- Implement all 27 V0.1 tables and 21 enums in Drizzle and one reviewed initial SQL migration.
- Use PostgreSQL partial unique indexes for the single active Edition, single current roster row,
  and single open Ballot per visitor/Edition.
- Use unique constraints for public identifiers, one Vote per Ballot, daily Ballot ordinals, Pool
  membership, and external identities.
- Use row-local checks for canonical pairs, Ballot/Vote state shape, counter bounds, score math,
  date ordering, JSON shape, session/import lifecycle, and audit completeness.
- Use `ON DELETE RESTRICT` throughout historical and domain foreign keys. Archival and disabling are
  the V0.1 deletion model.
- Map internal PostgreSQL `bigint` values to JavaScript `bigint`; API boundaries must serialize
  public representations deliberately rather than accepting precision loss.
- Keep cross-table Pool admission matching, Vote-to-Ballot orientation matching, Edition transition
  effects, and Edition score-sum verification in transactional services and integrity jobs.
- Use a fixed, guarded `csr_m1_test` database lifecycle for real PostgreSQL integration tests.
- Keep the development seed fictional, transactional, idempotent, and production-disabled.

## Alternatives considered

- Application-only uniqueness and state checks were rejected because concurrent requests can pass
  the same precondition.
- Database triggers for every cross-table rule were rejected because they would hide business
  transitions from the service layer and complicate testing and audit behavior.
- JavaScript `number` for bigint identifiers/counters was rejected because high-volume tables can
  exceed the safe integer range.
- Cascading deletes were rejected because Votes, Ballots, imports, and audits must remain
  historically attributable.
- Real teams and players in the seed were rejected because sample data could be mistaken for an
  approved Candidate Pool.

## Consequences

The database rejects the most dangerous invalid states regardless of application bugs or request
races. Service implementations still need explicit transactions, stable lock ordering, cross-table
validation, and integrity tests. Callers must handle `bigint` values and named PostgreSQL constraint
errors deliberately.

The initial migration is intentionally substantial. Gate B review must examine the SQL itself, not
only the Drizzle declarations.

## Validation

- Migrate a newly created PostgreSQL 18 database from empty.
- Assert the expected table and enum counts.
- Directly test named unique, partial-index, and check-constraint failures.
- Run the development seed twice and verify stable row counts.
- Run migration-journal checks, lint, formatting, typecheck, unit tests, integration tests, build,
  and Docker build before Gate B.
