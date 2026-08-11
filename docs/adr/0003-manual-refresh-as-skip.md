# ADR 0003: Treat manual voting-page refresh as Skip

- Status: Accepted
- Date: 2026-08-12
- Decision owner: Project Owner

## Context

The original V0.1 plan treated a browser refresh, a duplicate `/next` request, and a concurrent tab
as the same event: each reused the visitor's current open Ballot. The Owner revised the product
expectation after M3. For a visibly random-pair product, most users who manually refresh the voting
page expect a different pair.

Changing `/next` so every duplicate request consumes the current Ballot would be unsafe. HTTP
retries, double requests, and concurrent rendering can occur without deliberate user intent and
must not silently create Skip votes or consume extra ordinals.

## Decision

A true browser reload of the voting page is an explicit user abandonment action:

1. The M5 UI detects a reload navigation using the browser navigation entry.
2. It requests `/api/v1/ballots/next` normally.
3. If that response reused an existing open Ballot, it resolves that Ballot as `SKIP` through the M4
   idempotent Resolve API.
4. It then requests `/next` and renders the newly issued pair without a result interstitial.
5. If the first `/next` already issued a new Ballot because the old one expired or was resolved, the
   UI must not Skip that newly issued Ballot.

Ordinary repeated `/next` calls remain idempotent and return the same open Ballot. The server never
infers browser refresh from request repetition. No special replacement endpoint is added.

Refresh-created Skip is a normal auditable Skip: it creates one Vote exactly once, updates the
appropriate Skip counters, changes no score, does not refund the old opportunity, and the next
Ballot consumes a new daily ordinal.

## Consequences

- Manual refresh produces the new random pair users expect.
- Refresh cannot be used as free pair fishing because every replaced pair is recorded and consumes
  quota.
- M3's one-open-Ballot transaction and duplicate-request safety remain unchanged.
- M4 must make Skip resolution fully idempotent before the UI workflow exists.
- M5 must distinguish real reload navigation from normal render, API retry, revalidation, and another
  tab. It must suppress the ordinary post-vote result pause only for this reload path.
- Playwright must verify one Skip Vote, one new ordinal, a different Ballot ID, and no double effect
  under reload retries.

## Rejected alternatives

- Treat every repeated `/next` as Skip: unsafe under transport retries and concurrency.
- Add a special unaudited “replace pair” endpoint: duplicates Resolve logic and weakens exactly-once
  effects.
- Keep the original pair on manual refresh: conflicts with the Owner's revised product expectation.
