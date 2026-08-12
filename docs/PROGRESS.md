# Implementation Progress

## Current position

- **Milestone:** 4 — Vote resolution, ranking, and idempotency
- **Status:** Implemented; awaiting Owner Review Gate C
- **Review boundary:** M4 voting core is complete; implementation stops before the M5 public UI
- **Last updated:** 2026-08-12

## Completed

- Implemented `POST /api/v1/ballots/{publicId}/resolve` as a Node.js Next Route Handler with the
  shared mutation guard, strict UUID and `{ choice }` validation, anonymous visitor ownership,
  independent bounded availability limiting, `no-store`, safe error mapping, and detail-free
  unexpected failures.
- Implemented a locked `READ COMMITTED` resolution transaction. It locks the Ballot, permits one
  Vote, persists the Ballot's stored eligibility and issuance-day counters, and commits Vote,
  PairAggregate, ranking, usage, and Ballot state atomically.
- Implemented same-choice idempotent replay and conflicting-choice `409` behavior. Resolved Ballots
  remain readable after Edition closure; unresolved expired or inactive-Edition Ballots create no
  Vote or ranking effects.
- Implemented valid winner `+1` / loser `-1` and valid Skip `0` with both ranking rows locked in
  ascending player-ID order. The ranking projection uses competition ranks for ties.
- Implemented observed PairAggregate counters for all resolved actions and counted counters only for
  `VALID` Votes. `THROTTLED` and `SUSPICIOUS` Votes are durably stored and honestly returned as
  non-counting without changing rankings.
- Implemented immutable issuance-date usage accounting: valid resolution/Skip, throttled, and
  suspicious counters update the Ballot's original `usage_date`, even if it resolves after a
  Shanghai business-day boundary.
- Implemented `VoteModerationService.revoke`: only a valid Vote may be revoked; ranking and counted
  aggregate effects reverse transactionally, observed/usage history remains, and a complete
  `REVOKE_VOTE` moderation audit row records actor, reason, before, and after.
- Implemented `pnpm score:check -- --edition <code>`. It compares Vote, ranking, and counted pair
  totals and verifies zero-sum scores from one read-only `REPEATABLE READ` snapshot, emitting JSON
  and exiting nonzero on a violation.
- Completed the server half of ADR 0003: `SKIP` resolution is exactly-once and replay-safe. M5 still
  owns true browser-reload detection and the Skip-then-next orchestration.
- Added `docs/VOTE_RESOLUTION.md` and updated README, API, database, runbook, security, environment,
  and durable Codex handoff documentation.

## Validation

| Command/check           | Result | Notes                                                                                                                                                                                                 |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`             | PASS   | Zero warnings.                                                                                                                                                                                        |
| `pnpm format:check`     | PASS   | All tracked M4 source and documentation match Prettier.                                                                                                                                               |
| `pnpm typecheck`        | PASS   | Strict TypeScript `6.0.3`.                                                                                                                                                                            |
| `pnpm test:unit`        | PASS   | 15 files, 53 tests; adds eligibility, orientation, H2H, tied ranking, route validation/error/rate-limit tests.                                                                                        |
| `pnpm test:integration` | PASS   | 4 files, 21 tests against PostgreSQL 18; includes 100 concurrent resolves, conflicting retry, injected rollback points, Ballot 51, suspicious Vote, Skip replay, revoke/audit, freeze, and integrity. |
| `pnpm score:check`      | PASS   | Seeded Edition report: `healthy: true`, `scoreSum: "0"`, no violations.                                                                                                                               |
| `pnpm test:e2e`         | PASS   | Playwright remains configured with no M4 browser journey; the public voting journey belongs to M5.                                                                                                    |
| `pnpm build`            | PASS   | Next.js `16.3.0` Webpack production build includes both Ballot Route Handlers.                                                                                                                        |
| `pnpm db:check`         | PASS   | Existing migration journal remains valid; M4 requires no schema change.                                                                                                                               |
| `git diff --check`      | PASS   | No whitespace errors after documentation sync.                                                                                                                                                        |
| Docker image rebuild    | N/A    | No dependency, migration, Dockerfile, or container-runtime change.                                                                                                                                    |

## Decisions and corrections made during implementation

- M4 requires no migration. The reviewed M1 `ballot`, `vote`, `player_ranking`, `pair_aggregate`,
  `visitor_daily_usage`, and `moderation_audit_log` structures already support the full transaction.
- Resolution uses the persisted Ballot eligibility and `usage_date`; it never recalculates quota or
  assigns resolution to the current date. This preserves Ballot 51 semantics and midnight behavior.
- The Ballot row is the idempotency lock. The unique Vote constraint remains the database backstop,
  while same-choice repeats return current results and different-choice repeats return the original
  stored choice.
- Result ranking and H2H data is read after commit. It represents the latest committed public state
  and may include other Votes that committed immediately afterward; it is not a historical snapshot
  attached to the user's Vote.
- Revocation reverses only public counted effects. Observed aggregates, Ballot resolution, and daily
  usage remain as immutable evidence that the original action occurred and consumed an opportunity.
- The integrity checker was tightened during final review to use one read-only repeatable-read
  snapshot. Separate live reads could otherwise report a transient false mismatch during voting.
- Docker stayed off during coding and unit validation. It was started only for the PostgreSQL/final
  source validation window and stopped afterward to release the local VM resources.

## Known limitations

- M4 provides no public UI. The Vote page, result interstitial, Ranking/Player pages, and browser
  journey begin only after Gate C approval in M5.
- Manual-refresh-as-Skip is server-ready but not user-visible. M5 must detect a real reload, verify
  `/next` returned `reusedOpenBallot: true`, resolve that Ballot as Skip, and request the next pair.
- Vote revocation is a trusted domain service and has no HTTP/Admin surface until M6 authentication
  and authorization exist.
- The resolution availability limiter is process-local. Multi-instance limiting, proxy-aware IP
  risk keys, observe/enforce reason signals, and retention remain M8/M9 work.
- Player statistic fields remain `null`; approved snapshot ingestion remains M7.
- The integrity command detects and reports inconsistency but intentionally never repairs data.

## Next task

Owner Review Gate C: review the M4 transaction, concurrent/idempotent behavior, response payload,
quota/non-counting behavior, revocation, and integrity report. Only after explicit owner approval,
begin Milestone 5: the light-default responsive public Vote/Ranking/Player/About/Privacy vertical
slice, reload-as-Skip orchestration, accessibility, and Playwright journey.
