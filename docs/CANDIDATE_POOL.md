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

Automatic evaluation is deterministic and provider-independent. Milestone 7 supplies it with
approved, freshness-checked ranking snapshots and event evidence; the evaluator itself performs no
network requests and never applies a change automatically. Evidence must name the same year as the
persisted Edition code. A result range qualifies only when the complete range is inside the stated
threshold (`placementTo <= 4` for T1 Top 4 and `placementTo <= 8` for Major Top 8); an overlapping
range such as `3–6` is not a Top 4 result.

In operations, "automatic" means the Pool-draft job evaluates the rule consistently after its
inputs have been approved. It does not mean autonomous admission. Valve VRS is fetched by the
weekly Monday schedule; HLTV evidence and the Pool draft remain deliberate operator actions in
V0.1. The Admin dashboard points to the exact next step, and generated proposals appear in Admin for
separate approval or rejection. Review Manual Teams and Special Players originate only from
explicit Admin decisions with public reasons; the importer never invents them.

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

When an admitted Team signs a new formal starter at a later Pool update, the operator uses the
team-derived Player path rather than Special admission. It requires an active admitted Team, an
active Player, and that Player's current `STARTER` roster membership for the Team. The new Pool
Player entry references the existing Pool Team entry, inherits its `CORE`/`REVIEW_AUTO`/
`REVIEW_MANUAL` category, initializes a missing zero ranking row, writes both logs, and invalidates
the Edition cache after commit. Existing former starters and ranking history are not deleted or
reset; pairing eligibility is managed explicitly.

## Pairing state and cache

Disabling pairing updates the existing Pool Player row with a timestamp and reason. The Pool entry,
ranking row, votes, and all historical records remain intact. Re-enabling is allowed only while the
Player's professional status is `ACTIVE`.

Active-pool lookup selects only professionally `ACTIVE`, pairing-enabled players for an Edition. It
does not read admission type or ranking score. Ballot issuance revalidates the two randomly selected
rows under database locks, so the cache cannot issue a disabled or newly inactive player. The
in-process cache:

- is keyed by Edition ID;
- uses `ACTIVE_POOL_CACHE_TTL_SECONDS` (default 60 seconds);
- coalesces concurrent cache misses;
- explicitly invalidates after service-owned Pool mutations;
- clears all in-process snapshots after an audited Player update changes potential professional
  eligibility;
- prevents an invalidated in-flight load from repopulating stale data;
- falls back to PostgreSQL whenever no valid cache entry exists.

The CLI runs in a separate process, so an already-running web process observes CLI changes no later
than its short cache TTL. Admin UI and approved-import Pool mutations call the runtime service and
invalidate after their outer database transaction commits. Ballot issuance still revalidates its
chosen rows in PostgreSQL, so cache freshness is never the final safety boundary.

## Trusted CLI management

An operator with trusted database access can also add a new Special player or disable an admitted
player's future pairing through the recovery/automation CLIs:

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
are trusted operational tools, not authenticated public endpoints; database/host access is their
authorization boundary. The M6 Admin Console is the normal interactive operator surface.

The add command creates an active Player and admits them through the `SPECIAL` path atomically. It
must not be used for a formal starter joining an already admitted Team; use the Admin team-starter
workflow so provenance remains correct. The disable command is idempotent when the requested state
is already present. Both commands return a small JSON result and a non-zero exit code on failure.

To admit new Review Manual Teams with their current five starters (identity + HLTV URLs + roster +
Pool), use the Owner-reviewed manifest CLI. Dry-run first; apply requires `--actor`, `--apply`, and
`--confirm-review-manual`. Production writes go through the private Railway SSH tunnel, not
`railway run`. This is the workaround when Admin Team/Player create shows “Operation is temporarily
unavailable”. Check Audit before retrying the same slug: the write may already have committed. Do
not use `pool:add-player` (that is Special admission).

```bash
pnpm pool:admit-review-manual
pnpm pool:admit-review-manual -- \
  --actor owner --edition 2026 \
  --apply --confirm-review-manual
```

The 2026-08-17 set is `data/review-manual/2026-08-17.json`: BC.Game, 100 Thieves, TYLOO, and Lynn
Vision (short name LVG). Logos/portraits are omitted. Official HLTV stats for the expanded 90-player
set were recaptured 2026-08-17 (`capturedAt` `2026-08-17T13:18:41.536Z`; checksum
`2dc1b4b5ada7bada9350865e1740b1ce0f36c0bf89f21cbc51e670fb52b6a84c`) and wait on the Railway tunnel
import. Production reused the Owner's earlier Admin `tyloo` Team row (no roster at the time) and
left the unpooled `machinewjq` Player out of the Candidate Pool because that player is not on
TYLOO's current official starting five.

## Lifecycle boundaries

- Pool changes are allowed in `DRAFT` and `ACTIVE` Editions.
- `FROZEN` and `ARCHIVED` Edition Pools are immutable.
- Edition transitions move forward: `DRAFT -> ACTIVE -> FROZEN -> ARCHIVED`.
- Leaving `ACTIVE` expires that Edition's open Ballots in the same transaction.
- Confirmed T1 Event whitelist decisions are immutable historical facts.
- Roster conflicts are rejected; a current membership must be closed explicitly before another is
  created.
- Automated imports remain pending suggestions and are not part of Milestone 2.
