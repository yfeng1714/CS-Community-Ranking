# Vote Resolution, Ranking, and Revocation

Milestone 4 implements the exactly-once voting core. It does not add the public voting page; the
Milestone 5 client will call these APIs and use this result payload.

## Resolution contract

`POST /api/v1/ballots/{publicId}/resolve` accepts exactly one JSON field:

```json
{ "choice": "LEFT" }
```

`choice` is `LEFT`, `RIGHT`, or `SKIP`. The Ballot UUID and visitor cookie identify the issued
opportunity; client-supplied player IDs, Edition IDs, eligibility, and scores are never accepted.

A successful response contains:

- the stored choice, Vote status, whether it counted, and whether this was an idempotent replay;
- current left/right score, wins, losses, skips, and competition rank;
- current counted head-to-head decisions, skips, and left/right percentages.

Throttled and suspicious Votes return `200` because the action is durably recorded. Their response
honestly says `counted: false`; internal suspicious eligibility is disclosed only after resolution.
Every response is `Cache-Control: no-store`.

## Exactly-once transaction

Resolution runs in one PostgreSQL `READ COMMITTED` transaction:

1. Lock the Ballot row `FOR UPDATE` and verify visitor ownership.
2. Return an idempotent result if the Ballot already has the same resolution. A different retry
   returns `409 BALLOT_ALREADY_RESOLVED` with the original choice.
3. Lock and verify the Edition. Already-resolved Ballots remain readable after an Edition closes,
   while an unresolved Ballot cannot create effects unless its Edition is `ACTIVE` and it is within
   its persisted expiry.
4. Insert the one Vote allowed by `vote_ballot_unique`.
5. Upsert observed PairAggregate counters for every Vote and counted counters only for `VALID`.
6. For a valid decision, lock both ranking rows in ascending player-ID order and apply winner `+1`
   and loser `-1`. For a valid Skip, increment both players' skip counters without changing score.
7. Increment the appropriate `visitor_daily_usage` resolution counter using the Ballot's immutable
   issuance date, not the resolution clock's current date.
8. Mark the Ballot `RESOLVED` with its choice and timestamp, then commit.

Any error rolls back the Vote, both ranking effects, aggregates, usage counters, and Ballot state
together. Stable ranking lock order prevents opposite-orientation votes from creating an avoidable
deadlock. PostgreSQL deadlock/serialization errors receive bounded transaction retries.

The result projection is read after commit. Under concurrent activity it intentionally represents
the latest committed ranking and head-to-head state, not a historical snapshot frozen at this Vote.

## Eligibility and counters

| Ballot eligibility | Stored Vote status | Observed PairAggregate | Counted PairAggregate | Ranking effect |
| ------------------ | ------------------ | ---------------------- | --------------------- | -------------- |
| `ELIGIBLE`         | `VALID`            | Yes                    | Yes                   | Yes            |
| `THROTTLED`        | `THROTTLED`        | Yes                    | No                    | No             |
| `SUSPICIOUS`       | `SUSPICIOUS`       | Yes                    | No                    | No             |

The issuance transaction decides eligibility once and persists it on the Ballot. Resolution never
recomputes quota. Thus Ballot 51 is still a durable Vote and observed comparison, but does not
affect public rankings or counted head-to-head results.

## Manual refresh boundary

The resolve endpoint makes `SKIP` idempotent, which is the server half of ADR 0003. Milestone 5 will
detect a true browser reload, call `/next`, and only when that response says `reusedOpenBallot: true`
resolve the reused Ballot as `SKIP` before requesting a new pair. Ordinary duplicate `/next` and
resolve traffic remains retry-safe; the server never guesses that a repeated request means refresh.

## Revocation

`VoteModerationService.revoke` is the audited service boundary used by the future Admin UI. It:

- accepts only a currently `VALID` Vote and a nonblank reason;
- locks the Vote, Ballot, PairAggregate, and both ranking rows;
- reverses the ranking and counted PairAggregate effects in one transaction;
- keeps observed PairAggregate counters unchanged, preserving the fact that the action occurred;
- marks the Vote `REVOKED` with actor, reason, and timestamp; and
- writes a `REVOKE_VOTE` row to `moderation_audit_log` with before/after records.

Revocation intentionally does not rewrite the Ballot or daily usage counters. Those rows describe
the original user action and quota consumption; the Vote status and audit record describe the later
moderation decision. The trusted Admin HTTP surface is deferred to Milestone 6.

## Integrity check

Run the read-only checker against an Edition code:

```bash
pnpm score:check -- --edition 2026
```

It emits one JSON report and exits nonzero on a violation. It checks:

- `SUM(player_ranking.score) = 0`;
- ranking wins and losses match each other and valid non-Skip Votes;
- counted pair decisions match valid non-Skip Votes;
- ranking skip counters total twice the valid Skip count;
- counted pair skips match valid Skip Votes; and
- every ranking row still satisfies `score = wins - losses`.

This command detects inconsistencies; it never repairs or mutates data.
