# Database Notes

## Milestone 0 state

- PostgreSQL is the only application database.
- Local development uses the pinned PostgreSQL image in `docker-compose.yml`.
- `src/db/client.ts` provides a lazy node-postgres pool and Drizzle client.
- Readiness executes a lightweight `SELECT 1` through node-postgres.
- No domain schema or migration is implemented before Owner Review Gate A.

The complete proposed schema is in `docs/IMPLEMENTATION_PLAN_V0.1.md`. Milestone 1 must turn that
proposal into reviewed SQL migrations and database-level invariant tests before voting transactions
are implemented.
