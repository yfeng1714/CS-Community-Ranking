# Implementation Progress

## Current position

- **Milestone:** 2 — Candidate Pool domain and dynamic management core
- **Status:** Complete; owner review approved
- **Review boundary:** Milestone 2 approved on 2026-08-11; M3 not yet started
- **Last updated:** 2026-08-11

## Completed

- Implemented audited domain services for Edition, Team, Player, Roster, Event, and Candidate Pool
  management without Next.js dependencies.
- Implemented deterministic Core and Review Auto evaluation for either-source Top 12, either-source
  Top 20 plus same-year whitelisted T1 Top 4, and Major Top 8.
- Implemented explicit Review Manual team and Special individual admission paths with required
  public reasons.
- Made Team admission transactional across the Pool Team entry, exactly five current formal
  starters, missing Pool Player entries, zero-ranking initialization, Pool Change Logs, and Admin
  Audit Log.
- Preserved an already admitted player's original admission category and ranking history when their
  current Team is admitted later.
- Implemented history-preserving pairing disable/enable behavior; no Pool, ranking, Ballot, Vote, or
  audit row is deleted or reset.
- Implemented a configurable in-process active-pool cache with TTL, miss coalescing, explicit
  invalidation, and stale in-flight-load protection.
- Added trusted `pool:add-player` and `pool:disable-player` CLI commands for pre-Admin operation.
- Enforced forward Edition transitions, immutable FROZEN/ARCHIVED Pools, explicit roster-conflict
  handling, and immutable confirmed T1 whitelist decisions.
- Generalized the guarded integration database name from milestone-specific `csr_m1_test` to
  `csr_integration_test` without changing its explicit-target safety boundary.
- Added `docs/CANDIDATE_POOL.md`; converted the stale M0-only Codex prompt into a durable current
  handoff; and updated README, API, database, runbook, environment, and ADR documentation.

## Validation

| Command/check                    | Result | Notes                                                                                          |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PASS   | No dependency changes; lockfile remained reproducible with pnpm `11.16.0`.                     |
| `pnpm db:check`                  | PASS   | Existing reviewed migration metadata remains valid; M2 required no schema migration.           |
| `pnpm db:migrate`                | PASS   | Committed migration remains idempotent against the development database.                       |
| `pnpm db:seed`                   | PASS   | Fictional development seed remains repeatable.                                                 |
| `pnpm lint`                      | PASS   | Zero warnings.                                                                                 |
| `pnpm format:check`              | PASS   | All included files match Prettier.                                                             |
| `pnpm typecheck`                 | PASS   | Strict TypeScript `6.0.3`.                                                                     |
| `pnpm test:unit`                 | PASS   | 7 files, 30 tests, including all admission paths and active-cache races.                       |
| `pnpm test:integration`          | PASS   | 2 files, 14 tests against PostgreSQL 18, including real CLI subprocesses.                      |
| `pnpm test:e2e`                  | PASS   | Playwright remains configured; browser journeys begin with the later public voting slice.      |
| `pnpm build`                     | PASS   | Next.js `16.3.0` Webpack production build.                                                     |
| `git diff --check`               | PASS   | No whitespace errors.                                                                          |
| Docker image rebuild             | N/A    | M2 changes no runtime dependency, Dockerfile, or container configuration; source build passed. |

## Decisions and corrections made during implementation

- Corrected the previous M1 handoff label: the master plan and Product Decision Chronicle define
  M2 as Candidate Pool domain work. Ballot issuance is M3 and vote transactions are M4.
- Admission category is deliberately absent from active-player lookup and ranking initialization;
  it remains an auditable explanation, never a weight or probability input.
- Confirmed event-whitelist decisions are immutable historical facts. Event results may be corrected
  through audited updates, but a confirmed T1 decision is not silently rewritten.
- CLI commands run as trusted operational processes. Their `--actor` value provides persistent audit
  attribution; database/host access remains the authorization boundary until Admin authentication
  arrives in M6.
- Service-owned changes invalidate the active cache immediately. A separate CLI process cannot reach
  another process's memory, so a running web process observes CLI changes through the short TTL;
  same-process future Admin mutations invalidate immediately.
- Docker stayed off during coding and unit validation. It was started only for the final PostgreSQL
  validation window and shut down afterward to return laptop CPU and memory.

## Known limitations

- M2 introduces no public or Admin HTTP routes; Admin authentication and screens remain M6 work.
- Automatic rule evidence is an explicit domain input. Approved/fresh provider snapshots and pending
  Pool-draft generation remain M7 responsibilities; no external source can change the live Pool now.
- The active-pool cache is intentionally process-local because V0.1 uses one web instance and no
  Redis. Its TTL is the cross-process fallback for trusted CLI changes.
- CLI individual admission is the approved `SPECIAL` path. Team admissions use the service layer and
  will receive Admin UI and importer orchestration later.
- Anonymous visitor identity, uniform random pair selection, open-Ballot locking, quota ordinals, and
  expiration begin in M3.

## Next task

When the owner requests it, begin Milestone 3: secure anonymous visitor identity, one-open-Ballot
issuance, Asia/Shanghai daily ordinals, uniform random pair selection and left/right randomization,
expiration, infrastructure rate-limiter shell, and the guarded `POST /api/v1/ballots/next` endpoint.
