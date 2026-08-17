# Anonymous Visitor and Ballot Issuance

## Milestone 3 status

Milestone 3 implements the first public voting API boundary without implementing vote resolution.
The server can identify an anonymous browser, return its existing open Ballot, or atomically issue a
new uniformly random Ballot from the active Candidate Pool.

The implementation is split deliberately:

- `src/domain/visitors/service.ts` owns opaque token creation, HMAC hashing, lookup, and creation;
- `src/domain/ballots/` owns Shanghai dates, cryptographic random selection, transaction retries,
  expiry, quota ordinals, and response assembly;
- `src/security/rate-limiter.ts` is the bounded single-instance availability limiter;
- `src/app/api/v1/ballots/next/` applies the HTTP security guard and maps domain outcomes.

No raw visitor token is persisted or logged. PostgreSQL stores only
`HMAC-SHA-256(VISITOR_TOKEN_HASH_PEPPER, token)` as a 32-byte digest.

## Issuance transaction

Before opening the transaction, the process reads the current active-pool snapshot. This prevents a
cache miss from needing a second database connection while the transaction holds locks. The
transaction still revalidates and locks both selected Pool rows, so the cache is never a correctness
authority.

The transaction then:

1. locks the expected active Edition with `FOR SHARE`;
2. locks the visitor with `FOR UPDATE` and rejects a disabled visitor;
3. locks its open Ballot for the Edition;
4. returns an unexpired Ballot unchanged, without consuming another ordinal;
5. marks an expired Ballot `EXPIRED`, without refunding its original opportunity;
6. atomically upserts `visitor_daily_usage` for the `Asia/Shanghai` date and uses the returned count
   as `daily_ordinal`;
7. assigns `ELIGIBLE`, `THROTTLED`, or internal `SUSPICIOUS` eligibility;
8. selects two distinct IDs with Node's cryptographic random API, canonicalizes storage order, and
   independently randomizes left/right;
9. revalidates both selected players as pairing-enabled and professionally `ACTIVE` or `RETIRED` under row locks;
10. inserts the Ballot and commits.

The visitor lock serializes normal concurrent requests. The existing partial unique index
`ballot_one_open_per_visitor_edition` remains the final defense; insertion uses a savepoint so an
index conflict can recover the winning open Ballot without aborting the outer transaction. Deadlock
and serialization failures receive at most three attempts with bounded jitter.

If the active Edition or cached Pool changes mid-request, the transaction rolls back, invalidates
stale Pool state when appropriate, and retries from a fresh snapshot. An admission category, ranking
score, or prior exposure never enters pair selection.

## Public response and quota behavior

The response contains the public Ballot UUID, timestamps, ordinal, public ranking mode, quota
summary, and minimal left/right player cards. Statistics remain `null` until the approved data-source
work in Milestone 7.

An internally `SUSPICIOUS` Ballot is presented as `ELIGIBLE` before resolution so risk state does not
become an attacker feedback oracle. Ordinary post-quota `THROTTLED` mode remains in the API payload
and is enforced at resolution, but the public Vote UI does not disclose quota remaining or that a
Vote was throttled. The eligibility decision is persisted at issuance and does not change if Shanghai
midnight passes later.

All responses use `Cache-Control: no-store`. Expected public errors are:

- `403 VISITOR_DISABLED`;
- `429 INFRASTRUCTURE_RATE_LIMITED`, with `Retry-After`;
- `503 NO_ACTIVE_EDITION`;
- `503 POOL_NOT_READY`;
- detail-free `503 BALLOT_ISSUANCE_UNAVAILABLE` for unexpected failures.

## Infrastructure limiter boundary

`BALLOT_NEXT_RATE_LIMIT_PER_MINUTE` defaults to 30 requests per visitor per process.
`RATE_LIMITER_MAX_KEYS` defaults to 10,000. The fixed-window map removes expired keys and evicts the
least-recently-used key at capacity, so it cannot grow without bound.

This limiter protects the initial single web instance only. It is intentionally not ranking truth:
daily opportunities and Ballot state remain transactional in PostgreSQL. Cross-instance or IP-risk
enforcement belongs to the later anti-abuse milestone.

## Deferred boundary

Milestone 3 does not resolve, skip, or score a Ballot. Until Milestone 4 adds
`POST /api/v1/ballots/{publicId}/resolve`, an unexpired Ballot is intentionally returned on every
`/next` call. This is transport idempotency, not the final browser-refresh behavior.

Per the Owner's 2026-08-12 decision, M5 will detect a true manual voting-page reload. It will call
`/next`; only when `reusedOpenBallot` is true will it resolve that Ballot through M4 as an idempotent
`SKIP`, then request and render the next pair directly. If `/next` issued a new Ballot because no
reusable Ballot existed, the client must retain it. Vote creation, exactly-once effects, aggregates,
and result payloads remain M4; reload detection and orchestration remain M5. See ADR 0003.
