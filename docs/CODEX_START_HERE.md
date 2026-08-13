# Codex Start Here — CS Community Ranking

You are implementing **CS Community Ranking / CS 野榜 V0.1**.

## Required reading order

1. Read `docs/PROGRESS.md` for the completed milestone, exact validation state, known limitations,
   and the next authorized boundary.
2. Read `docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md` for product intent and “what
   we actually want.”
3. Read `docs/IMPLEMENTATION_PLAN_V0.1.md` in full before modifying the repository. It is the
   implementation source of truth unless the owner explicitly approves and records a change.
4. Read the focused domain, database, API, security, data-source, runbook, and ADR documents relevant
   to the requested milestone.

## Current handoff

Milestones 0–9 are implemented and Owner Review Gate E was approved on 2026-08-14. The complete repository received an independent Gate D audit on
2026-08-12, followed by fixture-tested Valve VRS/HLTV adapters, scheduled sync commands, explicit
source-snapshot approval, freshness/stale fallback, review-only Pool draft generation, daily ranking
snapshots, local asset attribution, privacy-preserving risk keys, observe/enforce abuse
classification, first-party KPIs, integrity/retention jobs, and security hardening. M9 direct
Railway staging is live; ADR 0004 selects Hobby logical backups and ADR 0005 owner-defers a custom
domain/Cloudflare edge layer. The first retained local backup, exact 14-table restore, and verified
private R2 second copy pass. The owner waived an artificial failed-deployment drill against the sole
active staging service and deliberate spend solely to trigger an alert. M10 is the next authorized
boundary, but no real Pool entry may be activated and no closed beta may start without the M10
owner-review steps.
See `docs/IMPLEMENTATION_REVIEW_2026-08-12.md` for Gate D,
`docs/STAGING_GATE_E.md` for the M9 evidence boundary, and `docs/PROGRESS.md` for current status.

Always trust the latest `docs/PROGRESS.md` over this summary if they ever differ.

## Non-negotiable product boundaries

- Do not change the ranking rule: valid winner `+1`, loser `-1`, Skip `0`.
- Do not add Elo, Bradley–Terry, fractional weighting, recommended pairing, or exposure balancing.
- Pairing remains true uniform random among enabled Candidate Pool players.
- A true manual refresh of the voting page resolves the reused open Ballot as Skip and then requests
  a new pair; ordinary `/next` retries remain idempotent. Follow ADR 0003 and do not infer refresh on
  the server from request repetition.
- Do not require public login.
- Admission category explains entry and never affects pairing probability or score.
- Do not automatically remove candidates, approve imported changes, or delete historical Votes.
- Do not add Redis, GraphQL, microservices, a separate backend, mandatory Cloudflare, Turnstile, or
  Event MVP to V0.1.
- Keep UI/API same-origin and business logic outside Next.js Route Handlers.
- Never run live HLTV requests in tests or CI.
- Do not invent production Candidate Pool data.

## Execution discipline

- Work only on the milestone requested by the owner and stop before the next milestone.
- Preserve the Product Decision Chronicle as the intent reference when documents contain a conflict.
- Record material corrections, deviations, and decisions in the relevant docs and ADRs.
- Add migrations only through reviewed ordered forward changes; never use production `db push`.
- Run the milestone-appropriate unit, PostgreSQL integration, lint, format, type, and build checks.
- Keep Docker Desktop off when containers are not needed. Start it only for PostgreSQL or production
  image validation, then stop the project containers and quit Docker Desktop afterward.
- Update `docs/PROGRESS.md` with exact results, limitations, and the next boundary before reporting.
- Do not commit or push unless the owner asks.

## Reporting format

Return:

1. What was implemented and where.
2. Exact checks run and their results.
3. Any deviation or correction to the plan.
4. Known limitations and deferred work.
5. The boundary where implementation stopped.
