# Independent Implementation Review — 2026-08-12

## Scope and method

This review was performed at Owner Review Gate D before Milestone 7. It did not accept conclusions
from earlier implementation turns as evidence. The repository was checked against the Product
Decision Chronicle, the complete implementation plan, every focused document under `docs/`, the
database schema and migrations, all application/domain code, scripts, configuration, CI, and the
existing tests.

The review combined source inspection, repository-wide searches for unsafe/deferred constructs,
strict static checks, a production build, isolated PostgreSQL migration/integration tests, desktop
and mobile Playwright journeys, and an independent visual pass of the Admin Console. No live
provider request was made and no production data was invented.

## Findings corrected

| Area                        | Finding                                                                                                                                                                                                                    | Correction                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI                          | CI never started PostgreSQL or exercised migrations/integration tests, despite the implementation-plan requirement.                                                                                                        | Added a pinned PostgreSQL service, empty-database migration step, and the full integration suite to CI.                                                                                                                                                                                                                                       |
| Pending imports             | The draft contract accepted unsupported Edition actions, trusted an external target key instead of internal IDs for updates, compared JSON by key order, and could misclassify imported Pool admissions as Manual/Special. | Replaced it with an exact versioned discriminated envelope; removed Edition actions; added Team/Player identities, Event results, automatic Team evidence, and team-derived starter actions; reloads state by canonical IDs; uses structural equality; checks envelope/change/Edition agreement; and applies the correct audited domain path. |
| Pool cache                  | Pending Pool approvals invalidated only a temporary cache, and Player professional-status changes could leave runtime Pool snapshots stale.                                                                                | Runtime cache invalidation now happens only after the outer review transaction commits. Player updates clear all in-process Pool snapshots; Pool actions invalidate their Edition.                                                                                                                                                            |
| Roster evolution            | After a Team was admitted, a newly signed formal starter had no correct admission path and could only be mislabeled as `SPECIAL`.                                                                                          | Added audited `pool.admit-team-player`, requiring an active admitted Team, an active Player, and a current formal `STARTER`; it inherits the Team entry's admission category and initializes ranking history without resetting anything.                                                                                                      |
| Admission rules             | Evidence could name the wrong Edition year, and an overlapping placement bracket such as `3–6` could incorrectly qualify as Top 4.                                                                                         | Evidence year must match the persisted Edition code. The whole placement range must fall within Top 4/Top 8, and evidence dates must be real calendar dates.                                                                                                                                                                                  |
| Admin input                 | Malformed JSON became `500`; schemas silently stripped extra fields; arbitrarily large IDs could reach PostgreSQL; browser-local Edition times had ambiguous timezone handling.                                            | Malformed JSON and non-exact bodies now return safe `400`s; IDs are positive signed-bigint values; datetime-local values are converted to timezone-bearing ISO timestamps; known PostgreSQL constraint/reference errors receive safe `400`/`409` mappings.                                                                                    |
| Admin login                 | The login limiter trusted `X-Real-IP` even when proxy-header trust was disabled, and trusted mode did not actually require an explicit provider mode.                                                                      | Direct requests use one direct key. Railway or Cloudflare identity headers are read only when `TRUST_PROXY_HEADERS=true`, and `CLIENT_IP_MODE` must then be explicitly configured.                                                                                                                                                            |
| Admin coverage              | Several screens promised by the plan were incomplete: detailed Team/Player edits and image paths, external identities, Event results, exact Vote search, full audit evidence, and accurate pending counts.                 | Added all of these workflows. Edition form defaults now come from validated configuration rather than duplicated literals. Sync parser metadata and before/after audit state are inspectable.                                                                                                                                                 |
| Dates and entity validation | JavaScript date normalization accepted impossible dates such as February 30; Event slugs and Edition numeric/date inputs were under-validated.                                                                             | Added calendar-exact shared date validation, kebab-case Event slugs, valid Edition timestamps, and PostgreSQL-integer bounds for quota/TTL.                                                                                                                                                                                                   |
| External statistics         | Public Rating queries could mix providers once M7 writes multiple snapshots.                                                                                                                                               | Public recent/career Rating projections now select only HLTV snapshots and label them as HLTV Rating. Other provider metrics remain isolated.                                                                                                                                                                                                 |
| Operator script             | `admin:create` could leave its database pool open after a failed insert.                                                                                                                                                   | Pool shutdown now runs in `finally`.                                                                                                                                                                                                                                                                                                          |

No database migration was required: the reviewed M1 schema already contained Event results and
external-identity tables, and the corrected workflows use those existing structures.

## Validation evidence

| Check                                      | Result                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `pnpm lint`                                | PASS, zero warnings                                                              |
| `pnpm format:check`                        | PASS                                                                             |
| `pnpm typecheck`                           | PASS under strict TypeScript 6                                                   |
| `pnpm test:unit`                           | PASS — 24 files, 90 tests                                                        |
| `pnpm db:check`                            | PASS                                                                             |
| `pnpm db:migrate`                          | PASS against PostgreSQL 18                                                       |
| `pnpm test:integration`                    | PASS — 7 files, 31 tests against isolated migrated databases                     |
| `pnpm test:e2e`                            | PASS — 6 desktop/mobile Chromium tests                                           |
| `pnpm build`                               | PASS — optimized Next.js 16.3.0 Webpack build                                    |
| `pnpm audit --prod --audit-level moderate` | PASS — no known production dependency vulnerability                              |
| Admin visual inspection                    | PASS at desktop width and 390 px; no document-level horizontal overflow observed |
| `git diff --check`                         | PASS                                                                             |

Docker was used only for the PostgreSQL and browser windows. The project container was stopped and
Docker Desktop was quit after verification.

## Boundary and remaining work

The review corrected implementation defects and missing Milestone 6 operator coverage; it did not
change a frozen product decision, so no new ADR is required. The true-refresh-as-Skip rule, uniform
random pairing, `+1/-1/0` score rule, anonymous public flow, append-only history, and explicit import
approval boundary are unchanged.

Milestone 7 remains unimplemented. Provider adapters, fixture parsers, sync commands, snapshot
writes, source attribution/assets, freshness propagation, and Candidate Pool proposal generation
must be built next without live requests in CI and without automatic application. Broader risk/IP
handling, analytics, retention jobs, and site-wide hardening remain Milestone 8. Deployment and
cloud database selection remain Milestone 9.
