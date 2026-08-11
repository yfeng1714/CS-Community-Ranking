# Candidate Pool Domain

## Milestone 2 status

The Candidate Pool is fully data-driven. Teams, players, rosters, Editions, events, admissions,
pairing state, ranking initialization, and audit history can change without editing application code
or redeploying the web application.

The implementation lives under `src/domain/`:

- `editions/`, `teams/`, `players/`, `rosters/`, and `events/` own their entity lifecycle rules;
- `pool/rules.ts` is the pure admission-rule evaluator;
- `pool/service.ts` owns transactional admission and pairing-state changes;
- `pool/active-pool-cache.ts` stores short-lived enabled-player ID snapshots by Edition.

## Admission rules

Admission categories explain why a candidate entered. They do not affect active-pool lookup,
pairing probability, initial score, or later scoring behavior.

| Category        | Implemented rule                                                                |
| --------------- | ------------------------------------------------------------------------------- |
| `CORE`          | HLTV or Valve VRS Top 12                                                        |
| `REVIEW_AUTO`   | Either source Top 20 plus same-year whitelisted T1 Top 4 or Major Top 8         |
| `REVIEW_MANUAL` | Explicit human approval with a nonblank public reason                           |
| `SPECIAL`       | Explicit individual approval, a nonblank public reason, and `ACTIVE` pro status |

Automatic evaluation is deterministic and provider-independent. Milestone 7 will supply it with
approved, freshness-checked ranking snapshots and event evidence; the evaluator itself performs no
network requests and never applies a change automatically.

## Team and individual admission

Team admission is one transaction:

1. Confirm the Edition is `DRAFT` or `ACTIVE` and the Team is active.
2. Require exactly five current `STARTER` roster memberships with active professional status.
3. Insert the Pool Team entry.
4. Insert missing Pool Player entries for the formal starting five.
5. Insert any missing `player_ranking` rows at zero without resetting existing history.
6. Write specialized Pool Change Log rows and a general Admin Audit Log row.
7. Commit, then invalidate that Edition's in-process active-pool cache.

An already admitted player is retained with their original admission category and ranking history
when their current Team is later admitted. No admission path deletes or resets a player.

Special admission creates or references one active Player, inserts a `SPECIAL` Pool entry with no
source Team entry, initializes the ranking row at zero, and writes the same audit history.

## Pairing state and cache

Disabling pairing updates the existing Pool Player row with a timestamp and reason. The Pool entry,
ranking row, votes, and all historical records remain intact. Re-enabling is allowed only while the
Player's professional status is `ACTIVE`.

Active-pool lookup selects only `edition_id`, `player_id`, and `pairing_enabled`; it does not read
admission type or ranking score. The in-process cache:

- is keyed by Edition ID;
- uses `ACTIVE_POOL_CACHE_TTL_SECONDS` (default 60 seconds);
- coalesces concurrent cache misses;
- explicitly invalidates after service-owned Pool mutations;
- prevents an invalidated in-flight load from repopulating stale data;
- falls back to PostgreSQL whenever no valid cache entry exists.

The CLI runs in a separate process, so an already-running web process observes CLI changes no later
than its short cache TTL. Future Admin UI mutations call the same service in the web process and
invalidate immediately.

## Trusted CLI management

Before the Admin UI exists, an operator with database access can add a new Special player or disable
an admitted player's future pairing:

```bash
pnpm pool:add-player -- \
  --actor development-seed \
  --edition 2026 \
  --slug sample-echo \
  --nickname Echo \
  --reason "Approved individual development inclusion"

pnpm pool:disable-player -- \
  --actor development-seed \
  --edition 2026 \
  --player sample-echo \
  --reason "No longer active for future pairing"
```

`--actor` must resolve to an existing `admin_user` and is persisted for attribution. These commands
are trusted operational tools, not authenticated public endpoints; database/host access is the
authorization boundary until Milestone 6 provides Admin authentication and UI workflows.

The add command creates an active Player and admits them through the `SPECIAL` path atomically. The
disable command is idempotent when the requested state is already present. Both commands return a
small JSON result and a non-zero exit code on failure.

## Lifecycle boundaries

- Pool changes are allowed in `DRAFT` and `ACTIVE` Editions.
- `FROZEN` and `ARCHIVED` Edition Pools are immutable.
- Edition transitions move forward: `DRAFT -> ACTIVE -> FROZEN -> ARCHIVED`.
- Leaving `ACTIVE` expires that Edition's open Ballots in the same transaction.
- Confirmed T1 Event whitelist decisions are immutable historical facts.
- Roster conflicts are rejected; a current membership must be closed explicitly before another is
  created.
- Automated imports remain pending suggestions and are not part of Milestone 2.
