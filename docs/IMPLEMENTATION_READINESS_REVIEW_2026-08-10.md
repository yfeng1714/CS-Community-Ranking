# CS Community Ranking — Implementation Readiness Review

**Review date:** 2026-08-10

**Reviewed scope:** repository root and every document under `docs/`
**Verdict:** ready to begin Milestone 0 after the V0.1.1 clarifications in this review

## Executive assessment

The project has a strong product core and a disciplined implementation shape.
The central product choices reinforce one another: open-ended community opinion,
uniform random pairing, transparent `+1/-1` scoring, guest-first voting, a governed
Candidate Pool, and auditable raw data. The milestone gates are appropriate for
an agent-assisted implementation and keep irreversible decisions reviewable.

Before this review, the plan was directionally ready but not fully safe to hand
to an implementation agent. Several required features had no persistence model,
some lifecycle cases were undefined, and basic mutation security was scheduled
after the routes that needed it. Those issues are now clarified without changing
the product scope.

## What is especially strong

1. **The product has a falsifiable V0.1 question.** It asks whether CS players
   will repeatedly make random pairwise choices and care about the resulting
   community ranking. Deferred features do not obscure that test.
2. **The ranking rule matches the brand.** The simple score is statistically
   imperfect by design, and the documents honestly record the exposure and
   late-entry biases instead of disguising them.
3. **The Candidate Pool is a governance system, not a hard-coded list.** Automated
   eligibility, transparent manual judgment, and human approval are cleanly
   separated.
4. **The Ballot model closes the obvious fishing loophole.** One open Ballot,
   opportunity-based quota, raw Vote retention, and database-enforced idempotency
   form a coherent correctness model.
5. **The architecture is proportionate.** A same-origin Next.js/PostgreSQL monolith
   keeps complexity in transactions, auditability, and tests rather than services
   and infrastructure.
6. **External data is correctly isolated.** Provider failures can make statistics
   stale but cannot stop voting.
7. **Owner Review Gates are placed at the right risk boundaries.** Foundation,
   schema, voting core, Admin, and staging operations deserve explicit review.

## V0.1.1 clarifications made

### Critical correctness

- Added the missing `pending_import_change` persistence model and stale/conflict
  revalidation rules.
- Specified `admin_user`, `admin_session`, and general `admin_audit_log` schemas.
- Added enforceable uniqueness for the single ACTIVE Edition and current roster
  membership, plus canonical/counter/state checks.
- Persisted a Ballot `usage_date` so a near-midnight resolution updates the same
  daily-usage row as issuance.
- Defined Edition deactivation: no new effects, open Ballots expire, and already
  resolved Ballots remain idempotently readable.
- Corrected Vote revoke semantics so a valid Skip reversal also decrements both
  players' skip counters.

### Security and privacy

- Moved reusable mutation Origin/Fetch-Metadata/content-type guards into Milestone
  0 and required them when each mutation route is introduced.
- Made the production `__Host-` visitor-cookie requirements explicit and defined
  the development fallback.
- Defined visitor/session token hashing as HMAC-SHA-256 with the configured secret.
- Added a 90-day default retention window after which daily IP-risk keys are
  nulled while Votes remain preserved.
- Prevented pre-resolution disclosure of suspicious risk classification.
- Added minimum Privacy-page disclosure and takedown/contact requirements. The M10 Owner decision
  later removed that route for the small community beta while retaining the underlying controls.

### Operations and data

- Clarified that Edition database values, not environment variables, are the
  runtime source of truth for quota and TTL.
- Clarified readiness as validated configuration plus PostgreSQL connectivity;
  DRAFT/FROZEN Edition state is a product status, not process unhealthiness.
- Added exact fields for previously sketched audit and external-sync tables.
- Required approved/fresh provider snapshots and conflict output for Pool drafts.
- Corrected the documented repository path of the implementation plan.
- Defined empty/small-sample H2H behavior: null percentages for zero counted
  decisions, visible sample size, and no hidden smoothing or false precision.

## Primary product risk to watch

The main remaining risk is cold-start density, not architecture. With 100 active
players there are 4,950 unordered pairs. Uniform randomness is the correct frozen
rule, but individual H2H results will remain sparse long after the overall ranking
starts moving. At 50,000 valid non-skip decisions, the average is only about ten
decisions per pair, although each player averages about 1,000 appearances.

This is acceptable if V0.1 treats H2H as transparent raw context rather than a
confident estimate. Closed beta should monitor counted decisions per pair/player,
the share of zero/low-sample results, skip rate, and whether sparse results reduce
Next-click behavior. Do not solve this by weighted or recommended pairing; adjust
copy, sample labels, Pool size governance, or launch expectations first.

## Remaining owner decisions

These do not block Milestone 0 and should remain owner decisions:

- final name, domain, slogan, and visual identity;
- production Candidate Pool, Manual Review teams, and Special players;
- completed-2026 T1 event whitelist;
- image sourcing/right-status review; the public contact route is deferred until a custom domain or
  materially broader usage;
- final quota after closed-beta data;
- Cloudflare proxy-on versus DNS-only after Mainland China network tests.

One timing decision should be made before Milestone 5: whether the public launch
is framed as a late-2026 Edition or whether 2026 is explicitly labeled a beta
Edition. This does not change the database model, but it affects user expectations
and public copy.

## Current platform assumptions verified

As of the review date, the official sources still support the plan's major
time-sensitive assumptions:

- Node.js 24 is LTS while Node.js 26 is Current:
  https://nodejs.org/en/about/previous-releases
- Railway offers a Southeast Asia region in Singapore:
  https://docs.railway.com/deployments/regions
- Cloudflare states that Turnstile is not supported in Mainland China:
  https://developers.cloudflare.com/china-network/faq/
- `__Host-` cookies require Secure, `Path=/`, and no Domain:
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie

## Recommended next action

Approve the clarified V0.1 plan, then give Codex only
`docs/CODEX_START_HERE.md`. Implement Milestone 0 and stop at Owner Review Gate A.
Do not start real Candidate Pool sourcing or HLTV integration during the foundation
milestone.

At Gate A, review the pinned versions, lockfile, Docker runtime, environment
validation, cookie/security primitives, health behavior, CI, and actual command
results before authorizing Milestone 1.
