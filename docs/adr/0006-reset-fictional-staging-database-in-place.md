# ADR 0006: Reset the fictional staging database in place for first production data

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owner:** Project Owner

## Context

The only Railway PostgreSQL service contains the explicitly fictional M9 staging Edition, sample
players, SKIPs, and audit history. There are no real users or production Votes. The first M10
proposal preserved that evidence by briefly creating a second empty Railway PostgreSQL service and
cutting the existing Web/cron stack over to it, but the owner challenged the extra resource because
the current data is disposable test data and the product is intentionally following a lowest-cost
posture.

The product's append-only history rule protects genuine operational and voting history. It does not
require fictional pre-launch fixtures to stay forever in the live service when their staging nature
is documented and a verified recovery copy is retained.

## Decision

Use one Railway PostgreSQL service. After the local real-data rehearsal and explicit final cutover
approval, reset the existing service's application schema in place and rebuild it only from
committed migrations.

1. Complete the Pool rehearsal in a separate clean local PostgreSQL database; never use either seed.
2. Pause the Railway Web and all six scheduled services for the cutover window.
3. Create a fresh final fictional-staging logical dump and manifest, restore-verify it in an isolated
   database, and verify its private R2 second copy.
4. Record the exact Railway project/environment/database target and obtain the owner's final
   destructive reset approval.
5. Reset only that PostgreSQL service's application schema, apply committed migrations, and verify
   that product tables are empty.
6. Recreate the owner Admin, create the real DRAFT Edition, and repeat source approval, Pool draft,
   individual proposal review, integrity, smoke, and launch-readiness checks with fresh inputs.
7. Resume Web and scheduled services only after the clean state and deployment are accepted.

The existing Railway domain, Web service, scheduled services, database service, Singapore placement,
and cost controls remain. The final staging backup is retained as evidence and a rollback source,
but it is not restored into the new production state unless the owner deliberately abandons the
cutover and returns to fictional staging.

## Alternatives considered

- **Temporary second Railway PostgreSQL service:** provides an easier side-by-side cutover and faster
  fallback, but adds temporary billed storage/compute and complexity before any real user exists.
- **Permanent parallel staging and production:** gives the strongest ongoing rehearsal environment,
  but duplicates persistent usage and conflicts with the current lowest-cost decision.
- **Rename or mutate the fictional Edition into production:** rejected because it would disguise test
  Votes/audits as real history and conflicts with the unique Edition code.

## Consequences

- There will be one Railway database before and after launch; no second cloud database is planned.
- The cutover has deliberate downtime, which is acceptable before real users exist.
- Rollback is slower and operator-driven: restore the verified fictional-staging dump or rebuild the
  clean schema and repeat approved imports.
- The schema reset is destructive and therefore remains a separately approved operational action;
  accepting this ADR does not authorize executing it early.
- Once meaningful real data or Votes exist, this pre-launch exception expires. Future changes must
  preserve real history and use forward migrations plus the approved backup policy.

## Validation

- Local rehearsal starts from committed migrations with zero seeded rows.
- The final pre-reset dump passes `backup:verify` and its private R2 object sizes/checksum metadata
  match the retained local copy.
- The reset target is recorded explicitly and the migrated production tables are verified empty
  before any Admin or product data is created.
- Smoke, integrity, and `launch:check` pass against the rebuilt Railway database before activation.
