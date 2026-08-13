# CS Community Ranking / CS 野榜
## Implementation Plan V0.1

**Status:** Implementation-ready after V0.1.3 Owner low-cost infrastructure revision

**Date:** 2026-08-12
**Primary audience:** Codex / Claude Code / Cursor and the human project owner  
**Working repository name:** `cs-community-ranking`  
**Working product name:** `CS Community Ranking` / `CS 野榜`  
**Production name and domain:** TBD

---

# 0. How this document must be used

This file is the implementation source of truth for V0.1.

V0.1.1 is a review clarification, not a product-scope change. It closes schema,
security, privacy, and lifecycle ambiguities found before Milestone 0. The frozen
ranking, pairing, guest-first, and Candidate Pool decisions are unchanged.

V0.1.2 records the Owner's 2026-08-12 interaction change: a true manual refresh of the voting page
resolves the reused open Ballot as Skip and immediately obtains a new pair. Ordinary API retries
remain idempotent. ADR 0003 defines the M4/M5 implementation boundary.

V0.1.3 records the Owner's 2026-08-13 early-operations decision: keep Railway Hobby, use verified
logical backups instead of upgrading solely for platform backups, launch initially on the
Railway-generated hostname, and defer a custom domain/Cloudflare until demand or measured abuse
justifies them. ADRs 0004 and 0005 define the recovery, security, and review-gate consequences.

An implementation agent must:

1. Read this entire document before changing code.
2. Work milestone by milestone, in the listed order unless the owner explicitly approves a change.
3. Treat every item under **Frozen product decisions** and **Security invariants** as non-negotiable.
4. Stop at each **Owner Review Gate**, report the code and test results, and wait for review before crossing the gate.
5. Add an Architecture Decision Record under `docs/adr/` before changing a frozen technical decision.
6. Keep `docs/PROGRESS.md` updated with completed tasks, test commands, known issues, and the next task.
7. Never substitute a “smarter” ranking or matchmaking system for the intentionally simple rules in this plan.
8. Never make external-data changes directly affect the live Candidate Pool without an explicit approval step.
9. Never run live HLTV scraping in CI.
10. Never physically delete votes or ranking history.

If the code and this document disagree, this document wins until the owner approves an ADR.

---

# 1. Product definition

A community-generated Counter-Strike professional-player ranking built from random one-versus-one choices.

The user opens the site and immediately sees two players. They choose the left player, choose the right player, or skip. The site does not prescribe a definition of “better.” Career achievements, current form, mechanical skill, personal preference, popularity, or any other interpretation may influence the vote.

The product intentionally measures community opinion rather than claiming objective competitive truth.

## 1.1 Core loop

```text
Open site
  -> receive one server-generated random Ballot
  -> choose Left / Right / Skip
  -> see counted status and community result
  -> inspect details if desired
  -> explicitly click Next
  -> repeat

Manual reload while a Ballot is open
  -> resolve the reused Ballot as Skip exactly once
  -> request and render a new Ballot directly
```

## 1.2 Product personality

- No judges.
- No hidden ranking formula.
- No prompt telling users how to interpret “better.”
- No claim of objective authority.
- Valid win: winner `+1`, loser `-1`.
- Skip: `0`.
- Pairing: true uniform random within the active Candidate Pool.

The site may describe itself as a “民榜” or “野榜.”

---

# 2. Frozen product decisions

The implementation agent must not change these without owner approval.

## 2.1 Ranking

- Every player enters an Edition with `score = 0`.
- A valid non-skip vote gives the selected player `+1` and the other player `-1`.
- A valid skip changes neither score.
- No Elo.
- No Bradley–Terry.
- No VRS-like opponent-strength weighting.
- No confidence multiplier.
- No fractional vote weight.
- A vote either counts in full or does not affect the ranking.
- The sum of all player scores in an Edition must always equal `0`.

## 2.2 Pairing

- Pairing is true uniform random over all players with `pairing_enabled = true` in the active Edition.
- No rank-proximity weighting.
- No exposure balancing.
- No popularity weighting.
- No preference learning.
- No “featured matchup” injection into the normal queue.
- The same pair may appear again naturally.
- Left/right placement is independently randomized.

## 2.3 User experience

- Anonymous visitors can vote immediately.
- Login is not required for public voting.
- The first useful screen is the vote interface, not a tutorial.
- The site does not ask “Who was better in 2026?” or “Who is stronger?”
- After voting, the result remains visible until the user explicitly clicks **Next**.
- There is no automatic transition to the next pair.
- A **Detailed data** control may expand additional statistics.
- Desktop and mobile must both be first-class responsive experiences.

## 2.4 Candidate Pool

- There is one large Player Pool per annual Edition.
- Admission categories explain why a player entered; they never alter vote probability or score behavior.
- An admitted player normally remains in that annual Edition even if their team later falls out of Tier 1.
- A player may be disabled from future pairing without deleting historical data.
- New players may be added during the Edition and start at `0`.
- The resulting late-entry disadvantage is accepted in V0.1.

## 2.5 Event MVP and annual editorial features

Not included in V0.1:

- Per-event MVP voting tabs.
- Personal Top 20.
- User accounts or Steam login.
- Comments, forums, friends, or social feeds.
- Dedicated historical GOAT Pool.
- Complex annual editorial presentation.

The database must not block those future features, but V0.1 must not implement them.

---

# 3. Candidate Pool rules

## 3.1 Edition lifecycle

Each natural year has an independent Edition, for example `2026`.

Suggested Edition statuses:

```text
DRAFT -> ACTIVE -> FROZEN -> ARCHIVED
```

- `DRAFT`: administrators prepare the pool; public pairing disabled.
- `ACTIVE`: public voting enabled.
- `FROZEN`: voting disabled and final ranking preserved.
- `ARCHIVED`: immutable historical Edition.

The initial product launches with a `2026` Edition even though the year is already in progress. The product does not need to overemphasize an official 2026 annual award at launch.

## 3.2 Admission categories

```text
CORE
REVIEW_AUTO
REVIEW_MANUAL
SPECIAL
```

### CORE

A team is automatically Core Tier 1 when it is in either:

- HLTV World Ranking Top 12; or
- official Valve Regional Standings / VRS Top 12.

The current formal starting five of that team are admitted.

### REVIEW_AUTO

A team automatically passes Review when:

1. It is Top 20 in either the latest HLTV ranking or latest VRS; and
2. During the same natural year it has achieved at least one of:
   - Top 4 at a whitelisted Tier 1 event; or
   - Top 8 at a Major.

The current formal starting five are admitted.

### REVIEW_MANUAL

The owner may manually admit a full team for publicly stated reasons, including:

- Significant relevance to the Chinese CS community.
- Important regional representation.
- Strong international competitive relevance not captured by a temporary ranking.
- A historically important team or a team containing major current stars.
- Ranking lag following a major roster rebuild.

Likely examples include TYLOO, Lynn Vision, or Liquid, but the live list is data, not hard-coded logic.

Every manual admission must record:

- admission date;
- human-readable reason;
- approving administrator;
- optional supporting source links.

### SPECIAL

A small number of still-active professional players may be admitted individually when their team is not admitted.

Likely initial examples include active versions of s1mple or device, subject to the final launch roster.

Special Inclusion must remain rare and must always have a public reason.

## 3.3 T1 Event Whitelist

An event becomes eligible for Review Auto through one of these paths:

1. **Major:** automatically Tier 1.
2. **HLTV Highlight Event:** normally copied into the site’s own whitelist after human confirmation.
3. **Manual Event Inclusion:** the owner may whitelist a non-highlighted event based primarily on participant quality, with international relevance and prize pool as secondary evidence.

Prize pool alone is not enough. A high-prize event with insufficient top-team participation does not need to be Tier 1.

The application stores its own immutable event-whitelist record. It must never dynamically ask HLTV at vote time whether an event is still highlighted.

## 3.4 Roster and removal behavior

- Team admission is based on the formal starting five at approval time.
- A newly signed formal starter can be added in the next Pool Update.
- A temporary stand-in is not automatically admitted.
- A player who transfers retains the same player identity, score, votes, and history.
- A player who leaves a team normally remains in the annual Edition while still professionally active.
- A formally retired or inactive player may have `pairing_enabled = false`; historical rows remain intact.
- There is no physical “delete player from history” operation.

## 3.5 Pool updates

- Normal review cadence: weekly.
- Emergency/manual update: allowed after major roster news.
- Every update creates an auditable Pool Change Log.
- Automated data import creates **pending changes**, never automatic live admissions.

---

# 4. V0.1 scope

## 4.1 Required public features

1. Anonymous visitor creation through a secure cookie.
2. One-open-Ballot voting flow.
3. Left / Right / Skip resolution.
4. Valid `+1/-1`, non-counting throttled/suspicious votes, and raw-vote retention.
5. Post-vote head-to-head result.
6. Explicit **Next** button.
7. Public ranking page.
8. Public player page.
9. About / Rules page.
10. Responsive desktop and mobile layout.
11. Data-freshness labels for external statistics.
12. Minimal first-party product analytics.

## 4.2 Required administrative features

1. Add/edit Team.
2. Add/edit Player.
3. Maintain roster membership.
4. Create/manage Editions.
5. Add Team to Pool with admission type and reason.
6. Add individual Player to Pool.
7. Enable/disable future pairing.
8. Maintain T1 Event Whitelist.
9. View and approve pending imported roster/pool changes.
10. View Pool Change Log.
11. Revoke a malicious vote without deleting it.
12. View integrity and data-sync status.

## 4.3 Explicitly deferred

- Public user accounts.
- Steam authentication.
- Personal rankings.
- Dedicated H2H search page.
- Event MVP Editions.
- Comments.
- Notifications.
- WebSockets.
- Redis.
- Search engine beyond simple player lookup.
- Multi-language admin system.
- Automated Candidate Pool approval.
- Cloudflare Turnstile.

---

# 5. Technical architecture

## 5.1 Chosen stack

```text
Language:          TypeScript
Runtime:           Node.js 24 LTS
Web framework:     Next.js App Router, Node.js runtime
UI:                React + Tailwind CSS
Validation:        Zod
Database:          PostgreSQL
Database access:   Drizzle ORM + node-postgres + explicit SQL where needed
Testing:           Vitest + real PostgreSQL integration tests + Playwright
Package manager:   pnpm, exact version pinned in package.json
Deployment:        Docker on Railway
Primary region:    Singapore
Edge layer:        Cloudflare optional and removable
Object storage:    None in V0.1; local static assets first
Cache/queue:        None in V0.1
```

Node.js must be pinned to an LTS release line. At the date of this plan, Node 24 is LTS while Node 26 is still Current. Do not switch to a Current release merely because it has a higher version number.

## 5.2 Architecture shape

```text
Browser
  |
  | HTTPS, same origin
  v
Optional Cloudflare proxy
  |
  v
Railway Singapore: one Next.js Node application
  |- React pages
  |- /api/v1/* Route Handlers
  |- Domain services
  |- Admin UI
  |- data-import commands
  |
  | Railway private network
  v
PostgreSQL

Railway scheduled jobs, built from the same repository
  |- daily ranking snapshot
  |- integrity checks
  |- external data sync
  |- expired-record cleanup
```

## 5.3 Monolith rules

- One repository.
- One deployable web application.
- One PostgreSQL database.
- Scheduled jobs reuse the same codebase with different commands.
- Do not create a separate Express/Fastify backend.
- Do not create microservices.
- Do not introduce GraphQL.
- Do not use Next.js Edge Runtime for database routes.
- Business logic must remain outside Route Handler files so it can be moved later if needed.

## 5.4 Layer boundaries

```text
Route Handler
  -> request/auth/origin validation
  -> Zod parsing
  -> domain service
  -> typed response mapping

Domain service
  -> business invariants and transaction orchestration
  -> no React or Next.js imports

Repository/DB layer
  -> Drizzle for routine queries
  -> explicit reviewed SQL for locks, partial indexes, upserts, and critical transactions

Data-source adapters
  -> fetch/parse/map external data
  -> no direct UI writes
```

---

# 6. Repository structure

Use a single non-monorepo repository.

```text
cs-community-ranking/
├─ src/
│  ├─ app/
│  │  ├─ (public)/
│  │  │  ├─ page.tsx
│  │  │  ├─ ranking/page.tsx
│  │  │  ├─ player/[slug]/page.tsx
│  │  │  ├─ about/page.tsx
│  │  │  └─ privacy/page.tsx
│  │  ├─ admin/
│  │  └─ api/v1/
│  │     ├─ ballots/next/route.ts
│  │     ├─ ballots/[publicId]/resolve/route.ts
│  │     ├─ rankings/route.ts
│  │     ├─ players/[slug]/route.ts
│  │     ├─ product-events/route.ts
│  │     └─ admin/...
│  ├─ components/
│  ├─ config/
│  ├─ data-sources/
│  │  ├─ hltv/
│  │  ├─ valve-vrs/
│  │  └─ shared/
│  ├─ db/
│  │  ├─ client.ts
│  │  ├─ schema/
│  │  └─ queries/
│  ├─ domain/
│  │  ├─ voting/
│  │  ├─ ranking/
│  │  ├─ pool/
│  │  ├─ anti-abuse/
│  │  ├─ admin/
│  │  └─ analytics/
│  ├─ security/
│  ├─ services/
│  ├─ observability/
│  └─ types/
├─ drizzle/
├─ public/
│  ├─ players/
│  ├─ teams/
│  └─ placeholders/
├─ assets/
│  └─ attribution.json
├─ scripts/
│  ├─ seed.ts
│  ├─ create-admin.ts
│  ├─ build-pool-draft.ts
│  ├─ sync-hltv.ts
│  ├─ sync-vrs.ts
│  ├─ snapshot-ranking.ts
│  ├─ integrity-check.ts
│  └─ revoke-votes.ts
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/
│  └─ fixtures/
├─ docs/
│  ├─ adr/
│  ├─ CODEX_START_HERE.md
│  ├─ IMPLEMENTATION_PLAN_V0.1.md
│  ├─ REVIEW_SUMMARY_ZH.md
│  ├─ CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md
│  ├─ IMPLEMENTATION_READINESS_REVIEW_2026-08-10.md
│  ├─ API.md
│  ├─ DATABASE.md
│  ├─ SECURITY.md
│  ├─ RUNBOOK.md
│  ├─ DATA_SOURCES.md
│  ├─ PROGRESS.md
│  └─ OPEN_QUESTIONS.md
├─ Dockerfile
├─ docker-compose.yml
├─ drizzle.config.ts
├─ next.config.ts
├─ package.json
└─ pnpm-lock.yaml
```

---

# 7. Configuration

All environment variables must be validated at process startup with Zod. Missing or malformed required configuration must fail fast.

Suggested variables:

```text
NODE_ENV
APP_ORIGIN
DATABASE_URL
APP_TIME_ZONE=Asia/Shanghai

VISITOR_COOKIE_NAME=__Host-csr_visitor
VISITOR_COOKIE_MAX_AGE_DAYS=365
VISITOR_TOKEN_HASH_PEPPER
IP_HMAC_SECRET
ADMIN_SESSION_SECRET

ACTIVE_EDITION_CODE=2026
DEFAULT_FULL_WEIGHT_BALLOTS_PER_DAY=50
DEFAULT_BALLOT_TTL_MINUTES=30
RISK_ENFORCEMENT_MODE=observe
IP_RISK_KEY_RETENTION_DAYS=90
PRODUCT_EVENT_RETENTION_DAYS=90

CLIENT_IP_MODE=railway|cloudflare
TRUST_PROXY_HEADERS=true|false

LOG_LEVEL=info
SENTRY_DSN=optional

HLTV_SYNC_ENABLED=true|false
HLTV_REQUEST_DELAY_MS
HLTV_USER_AGENT
VRS_SOURCE_URL

ADMIN_BOOTSTRAP_USERNAME
ADMIN_BOOTSTRAP_PASSWORD_HASH
```

Rules:

- Thresholds must not be scattered as numeric literals in business code.
- The active `edition` row is the runtime source of truth for quota and Ballot
  TTL. The `DEFAULT_*` variables are bootstrap defaults used when an Edition is
  created; changing them must not silently change an existing Edition.
- `APP_TIME_ZONE` is fixed to `Asia/Shanghai` for V0.1. A different value must
  fail validation because quota dates are persisted business data.
- Production secrets must never use development defaults.
- No raw IP address may be written to logs or the database.
- `APP_ORIGIN` is the sole allowed browser mutation origin in production.
- `TRUST_PROXY_HEADERS` may be true only with an explicitly selected and tested
  `CLIENT_IP_MODE`; arbitrary forwarding headers must never be trusted.

---

# 8. Database model

Use UTC timestamps in PostgreSQL. Compute quota dates using `Asia/Shanghai` at issuance time.

Use `bigint generated always as identity` for high-volume internal primary keys. Use a random UUID `public_id` for externally addressable Ballots. Slugs are public identifiers for players and teams.

Unless a field is explicitly marked nullable, it is `NOT NULL`. Foreign keys
from historical or audit data use `ON DELETE RESTRICT`; V0.1 domain records are
disabled or archived, not deleted. Every counter has a non-negative database
check. Migration SQL—not only Drizzle declarations—is reviewed at Gate B.

## 8.1 Core identity and competition tables

### `team`

- `id bigint primary key`
- `slug text unique not null`
- `name text not null`
- `short_name text nullable`
- `country_code text nullable`
- `logo_path text nullable`
- `active boolean not null default true`
- `created_at timestamptz`
- `updated_at timestamptz`

### `player`

- `id bigint primary key`
- `slug text unique not null`
- `nickname text not null`
- `real_name text nullable`
- `country_code text nullable`
- `photo_path text nullable`
- `professional_status enum(ACTIVE, INACTIVE, RETIRED)`
- `created_at timestamptz`
- `updated_at timestamptz`

### `roster_membership`

- `id bigint primary key`
- `player_id fk player`
- `team_id fk team`
- `status enum(STARTER, BENCH, STAND_IN)`
- `starts_at date`
- `ends_at date nullable`
- `source text nullable`
- Index current roster by `team_id, ends_at, status`.

A player identity never changes when the player changes team.

Required checks and indexes:

```text
ends_at IS NULL OR ends_at >= starts_at
at most one current roster_membership per player (ends_at IS NULL)
```

Roster import conflicts that would violate the current-membership constraint
remain pending for human resolution; an importer must not silently close the
old row.

### `edition`

- `id bigint primary key`
- `code text unique not null`, e.g. `2026`
- `name text not null`
- `status enum(DRAFT, ACTIVE, FROZEN, ARCHIVED)`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `full_weight_ballots_per_day int not null default 50`
- `ballot_ttl_minutes int not null default 30`
- `created_at timestamptz`
- `updated_at timestamptz`

At most one Edition may be `ACTIVE` in V0.1.

Enforce that rule with a partial unique index over a constant expression where
`status = 'ACTIVE'`, and require `ends_at > starts_at`. Status transitions are
validated by the Edition service. Moving an Edition out of `ACTIVE` disables
new Ballots and atomically marks its existing `OPEN` Ballots `EXPIRED`.

## 8.2 Event and pool tables

### `event`

- `id bigint primary key`
- `slug text unique`
- `name text`
- `starts_at date`
- `ends_at date`
- `is_major boolean`
- `is_t1_whitelisted boolean`
- `whitelist_reason enum(MAJOR, HLTV_HIGHLIGHT, MANUAL, NONE)`
- `whitelist_note text nullable`
- `approved_at timestamptz nullable`
- `approved_by admin_user_id nullable`

`is_t1_whitelisted = true` requires a non-`NONE` reason plus approval metadata.
`is_major = true` uses `MAJOR` as the whitelist reason once confirmed.

### `event_team_result`

- `event_id`
- `team_id`
- `placement_from int`
- `placement_to int`
- Primary key `(event_id, team_id)`.

Require positive placement values and `placement_to >= placement_from`.

### `pool_team_entry`

- `id bigint primary key`
- `edition_id`
- `team_id`
- `admission_type enum(CORE, REVIEW_AUTO, REVIEW_MANUAL)`
- `admission_reason text`
- `admitted_at timestamptz`
- `approved_by admin_user_id`
- Unique `(edition_id, team_id)`.

### `pool_player_entry`

- `id bigint primary key`
- `edition_id`
- `player_id`
- `source_team_entry_id nullable`
- `admission_type enum(CORE, REVIEW_AUTO, REVIEW_MANUAL, SPECIAL)`
- `admission_reason text`
- `admitted_at timestamptz`
- `pairing_enabled boolean not null default true`
- `pairing_disabled_at timestamptz nullable`
- `pairing_disabled_reason text nullable`
- `approved_by admin_user_id`
- Unique `(edition_id, player_id)`.

`SPECIAL` entries have no `source_team_entry_id`; team-derived entries require
one and must use the same admission type as that Team entry. These semantics are
enforced by the service and tested even where a cross-table database check is
not practical.

### `player_ranking`

- `edition_id`
- `player_id`
- `score integer not null default 0`
- `wins bigint not null default 0`
- `losses bigint not null default 0`
- `skips bigint not null default 0`
- `updated_at timestamptz`
- Primary key `(edition_id, player_id)`.

Application and database checks must enforce:

```text
score = wins - losses
wins >= 0
losses >= 0
skips >= 0
```

The global Edition invariant is checked by a scheduled job:

```text
SUM(player_ranking.score) = 0
```

## 8.3 Anonymous visitor and usage tables

### `anonymous_visitor`

- `id bigint primary key`
- `token_hash bytea unique not null`
- `created_at timestamptz`
- `last_seen_at timestamptz`
- `disabled_at timestamptz nullable`
- `risk_state enum(NORMAL, WATCH, SUSPICIOUS) default NORMAL`

The plaintext visitor token exists only in the browser cookie. Store only a cryptographic hash of the high-entropy token.

### `visitor_daily_usage`

- `visitor_id`
- `edition_id`
- `usage_date date` in `Asia/Shanghai`
- `ballots_issued int not null default 0`
- `valid_resolved int not null default 0`
- `valid_skips int not null default 0`
- `throttled_resolved int not null default 0`
- `suspicious_resolved int not null default 0`
- Primary key `(visitor_id, edition_id, usage_date)`.

The quota is based on issued Ballots, not only submitted votes.

`valid_resolved` counts valid non-skip decisions; `valid_skips` counts valid
skips. Resolution counters are updated on the Ballot's persisted `usage_date`,
not whichever local date happens to be current when a near-midnight Ballot is
resolved.

## 8.4 Ballot and vote tables

### `ballot`

- `id bigint primary key`
- `public_id uuid unique not null`
- `edition_id`
- `visitor_id`
- `player_1_id`
- `player_2_id`
- `left_player_id`
- `right_player_id`
- `issued_at timestamptz`
- `expires_at timestamptz`
- `usage_date date` in `Asia/Shanghai`
- `status enum(OPEN, RESOLVED, EXPIRED)`
- `resolution enum(LEFT, RIGHT, SKIP) nullable`
- `ranking_eligibility enum(ELIGIBLE, THROTTLED, SUSPICIOUS)`
- `daily_ordinal int not null`
- `issued_ip_risk_key bytea nullable`
- `resolved_at timestamptz nullable`

Required checks:

```text
player_1_id < player_2_id
left_player_id != right_player_id
{left_player_id, right_player_id} = {player_1_id, player_2_id}
expires_at > issued_at
OPEN     -> resolution IS NULL AND resolved_at IS NULL
RESOLVED -> resolution IS NOT NULL AND resolved_at IS NOT NULL
EXPIRED  -> resolution IS NULL AND resolved_at IS NULL
```

Required partial unique index:

```sql
CREATE UNIQUE INDEX ballot_one_open_per_visitor_edition
ON ballot(visitor_id, edition_id)
WHERE status = 'OPEN';
```

### `vote`

- `id bigint primary key`
- `ballot_id unique not null`
- `edition_id`
- `visitor_id`
- `choice enum(LEFT, RIGHT, SKIP)`
- `winner_player_id nullable`
- `loser_player_id nullable`
- `status enum(VALID, THROTTLED, SUSPICIOUS, REVOKED)`
- `risk_reason_codes jsonb not null default '[]'`
- `ip_risk_key bytea nullable`
- `created_at timestamptz`
- `revoked_at timestamptz nullable`
- `revoked_by admin_user_id nullable`
- `revoked_reason text nullable`

A Ballot may create at most one Vote. A retry must never create another score mutation.

Require `winner_player_id` and `loser_player_id` to be null for `SKIP`, and
both non-null and distinct for `LEFT`/`RIGHT`. The service additionally verifies
that they match the Ballot's stored orientation; this cross-table rule is covered
by integration tests.

### `pair_aggregate`

Canonical player ordering only:

- `edition_id`
- `player_1_id`
- `player_2_id`
- `counted_player_1_wins bigint default 0`
- `counted_player_2_wins bigint default 0`
- `counted_skips bigint default 0`
- `observed_player_1_choices bigint default 0`
- `observed_player_2_choices bigint default 0`
- `observed_skips bigint default 0`
- `updated_at timestamptz`
- Primary key `(edition_id, player_1_id, player_2_id)`.

Require `player_1_id < player_2_id` and every counted/observed counter to be
non-negative. Each counted choice/skip counter must be less than or equal to its
corresponding observed counter.

Public percentages use counted wins only:

```text
counted_decisions = counted_player_1_wins + counted_player_2_wins
player_1_pct = NULL when counted_decisions = 0;
               otherwise counted_player_1_wins / counted_decisions
```

Skip count is displayed separately and excluded from the two-player percentage
denominator. Do not invent `50/50`, Laplace smoothing, or hidden pseudo-votes for
an empty or small sample.

## 8.5 History, analytics, and audit tables

### `daily_ranking_snapshot`

- `edition_id`
- `snapshot_date date`
- `player_id`
- `rank int`
- `score int`
- `wins bigint`
- `losses bigint`
- `skips bigint`
- Primary key `(edition_id, snapshot_date, player_id)`.

Players with the same score receive the same displayed rank. Use SQL `RANK()`, not `ROW_NUMBER()`.

### `product_event`

- `id bigint primary key`
- `visitor_id nullable`
- `edition_id nullable`
- `event_type enum(PAGE_VIEW, RANKING_VIEW, PLAYER_VIEW, VOTE_RESULT_VIEW, NEXT_CLICK, SHARE_CLICK)`
- `metadata jsonb`
- `occurred_at timestamptz`

Do not put secrets, raw IPs, or player-vote choices in arbitrary analytics metadata.

### `pool_change_log`

- `id bigint primary key`
- `actor_admin_user_id fk admin_user`
- `edition_id fk edition`
- `action text`
- `target_type enum(POOL_TEAM, POOL_PLAYER, PAIRING_STATE)`
- `target_id text`
- `reason text`
- `before jsonb nullable`
- `after jsonb nullable`
- `created_at timestamptz`

### `moderation_audit_log`

- `id bigint primary key`
- `actor_admin_user_id fk admin_user`
- `action enum(REVOKE_VOTE)`
- `vote_id fk vote`
- `reason text`
- `before jsonb`
- `after jsonb`
- `created_at timestamptz`

### `admin_user` and `admin_session`

`admin_user`:

- `id bigint primary key`
- `username text unique not null`
- `password_hash text not null`
- `active boolean not null default true`
- `created_at timestamptz`
- `updated_at timestamptz`

`admin_session`:

- `id bigint primary key`
- `admin_user_id fk admin_user`
- `token_hash bytea unique not null`
- `created_at timestamptz`
- `expires_at timestamptz`
- `last_seen_at timestamptz`
- `revoked_at timestamptz nullable`

No public registration. Passwords use a maintained Argon2id implementation.
Sessions use 32-byte opaque random tokens; only HMAC-SHA-256 token hashes are
stored. Expired, revoked, or inactive-user sessions are rejected.

### `admin_audit_log`

- `id bigint primary key`
- `actor_admin_user_id fk admin_user`
- `action text`
- `target_type text`
- `target_id text`
- `reason text`
- `before jsonb nullable`
- `after jsonb nullable`
- `created_at timestamptz`

Every successful admin mutation writes this general audit row in the same
transaction. `pool_change_log` and `moderation_audit_log` remain the specialized,
query-friendly records for those two domains.

### `pending_import_change`

- `id bigint primary key`
- `sync_run_id fk sync_run`
- `edition_id fk edition nullable`
- `change_type enum(TEAM, PLAYER, ROSTER, EVENT, POOL_TEAM, POOL_PLAYER)`
- `target_external_key text`
- `proposed_data jsonb`
- `conflict_codes jsonb not null default '[]'`
- `status enum(PENDING, APPROVED, REJECTED, SUPERSEDED)`
- `created_at timestamptz`
- `reviewed_at timestamptz nullable`
- `reviewed_by admin_user_id nullable`
- `review_reason text nullable`
- `applied_at timestamptz nullable`

Approval and application happen in one audited transaction. The application
revalidates source freshness, current state, and conflicts; it must not blindly
replay stale proposed JSON. A new sync may supersede but never delete an older
pending record.

## 8.6 External data tables

### `player_external_identity`

- `player_id fk player`
- `provider enum(HLTV, LIQUIPEDIA, PANDASCORE, BO3, OTHER)`
- `external_id text`
- `external_slug text nullable`
- `source_url text`
- `last_verified_at timestamptz`
- Unique `(provider, external_id)`.

### `team_external_identity`

- `team_id fk team`
- `provider enum(HLTV, LIQUIPEDIA, PANDASCORE, BO3, OTHER)`
- `external_id text`
- `external_slug text nullable`
- `source_url text`
- `last_verified_at timestamptz`
- Unique `(provider, external_id)`.

### `player_stat_snapshot`

- `id bigint primary key`
- `player_id fk player`
- `provider enum(HLTV, LIQUIPEDIA, PANDASCORE, BO3, OTHER)`
- `metric text`, e.g. `rating_3_0`, `career_rating`, `adr`, `kast`
- `period_type enum(LAST_3_MONTHS, CAREER, CUSTOM)`
- `period_start date nullable`
- `period_end date nullable`
- `value numeric`
- `maps int nullable`
- `captured_at timestamptz`
- `source_url text`

Require non-negative `maps`, `period_end >= period_start` when both exist, and
an index supporting the latest snapshot by `(player_id, provider, metric,
period_type, captured_at DESC)`.

### `ranking_source_snapshot`

- `id bigint primary key`
- `provider enum(HLTV, VALVE_VRS)`
- `captured_at timestamptz`
- `published_at timestamptz nullable`
- `parser_version text`
- `normalized_data jsonb`
- `raw_checksum text`
- `approved_at timestamptz nullable`
- `approved_by admin_user_id nullable`

Raw source bodies are kept as restricted import artifacts only when needed for
debugging and licensing/terms permit it; they are not written to application
logs or served publicly.

### `sync_run`

- `id bigint primary key`
- `job_name text`
- `provider text`
- `started_at timestamptz`
- `finished_at timestamptz nullable`
- `status enum(RUNNING, SUCCEEDED, FAILED, PARTIAL)`
- `records_seen int not null default 0`
- `records_changed int not null default 0`
- `error_summary text nullable`
- `source_freshness_at timestamptz nullable`
- `metadata jsonb not null default '{}'`

---

# 9. Public ranking semantics

## 9.1 Ordering

Primary ranking key:

```text
score DESC
```

Ties:

- Players with equal score display the same rank.
- Within a tied visual group, use:
  1. valid decisions descending;
  2. nickname ascending.

These secondary fields are only display ordering. They do not change the tied rank.

## 9.2 Public fields

Ranking page:

- rank;
- player nickname/photo;
- current team;
- score;
- wins;
- losses;
- win rate;
- total valid decisions;
- optional skip rate;
- data freshness.

Win rate:

```text
wins / (wins + losses)
```

Skips are not included in win rate.

## 9.3 Player page

Required:

- current rank;
- score;
- wins, losses, win rate;
- total appearances and skips;
- current team and country;
- recent Rating and map count if available;
- latest data timestamp;
- ranking history chart may be deferred until snapshots exist, but the snapshots must be collected from day one.

---

# 10. Visitor identity and cookie

On first public mutation or Ballot request, create a 32-byte cryptographically random visitor token.

Store `HMAC-SHA-256(VISITOR_TOKEN_HASH_PEPPER, token)`, not a reversible token
or a fast hash without the configured pepper. Token comparison uses the stored
binary digest.

Cookie:

```text
Name:     __Host-csr_visitor
Secure:   true
HttpOnly: true
SameSite: Lax
Path:     /
Domain:   omitted
Max-Age:  configurable, initial 365 days
```

- Client JavaScript never reads the visitor token.
- The database stores only a hash of the random token.
- A `__Host-` cookie is always `Secure`, has `Path=/`, and omits `Domain`.
  Localhost is permitted to use Secure cookies by modern browsers. If a specific
  non-HTTPS development environment cannot do so, it must use an explicit
  unprefixed development-only cookie name; production startup rejects that name.
- Clearing cookies creates a new visitor identity; IP risk aggregation is a secondary defense.
- Visitor identity is not an account and carries no public profile.

---

# 11. Voting API contract

All mutation endpoints use `POST`. All vote endpoints return `Cache-Control: no-store`.

## 11.1 `POST /api/v1/ballots/next`

### Request

No body.

Browser sends the anonymous visitor cookie. If absent, the server creates a visitor and sets the cookie.

### Required behavior

Within one database transaction:

1. Lock the `anonymous_visitor` row with `FOR UPDATE`.
2. Find an existing `OPEN` Ballot for the active Edition.
3. If it exists and is not expired, return it unchanged.
4. If it is expired, mark it `EXPIRED`; do not refund its daily ordinal.
5. Upsert and increment `visitor_daily_usage.ballots_issued` for the `Asia/Shanghai` date.
6. Use the returned count as `daily_ordinal`.
7. Determine `ranking_eligibility`:
   - `ELIGIBLE` when ordinal is within the configured full-weight quota and risk enforcement permits it;
   - `THROTTLED` after quota;
   - `SUSPICIOUS` for enforced high-risk traffic.
8. Uniformly choose two distinct active Pool players on the server.
9. Canonicalize `player_1_id < player_2_id`.
10. Randomize which player appears left and right.
11. Insert the Ballot with that same local date persisted as `usage_date`.
12. Commit and return it.

The database partial unique index is the final protection against two simultaneous open Ballots.

### Response example

```json
{
  "ballot": {
    "id": "5cdcae3c-0c67-4ee8-96f0-dfbb07a7ac25",
    "issuedAt": "2026-08-09T08:00:00Z",
    "expiresAt": "2026-08-09T08:30:00Z",
    "dailyOrdinal": 14,
    "rankingMode": "ELIGIBLE",
    "left": {
      "slug": "donk",
      "nickname": "donk",
      "team": "Spirit",
      "country": "RU",
      "photoUrl": "/players/donk.webp",
      "recentRating": 1.40,
      "recentMaps": 42,
      "careerRating": null,
      "statsCapturedAt": "2026-08-09T02:00:00Z"
    },
    "right": {
      "slug": "zywoo",
      "nickname": "ZywOo",
      "team": "Vitality",
      "country": "FR",
      "photoUrl": "/players/zywoo.webp",
      "recentRating": 1.33,
      "recentMaps": 39,
      "careerRating": null,
      "statsCapturedAt": "2026-08-09T02:00:00Z"
    }
  },
  "quota": {
    "fullWeightLimit": 50,
    "remainingEligibleBallots": 36
  },
  "reusedOpenBallot": false
}
```

Repeated transport-level calls before resolution return the same Ballot and do not increment the
ordinal. This protects retries, concurrent rendering, and multiple tabs; request repetition alone is
never interpreted as a user refresh.

The Owner's 2026-08-12 refresh decision is implemented at the public UI boundary after M4 supplies
idempotent Skip resolution. On a true voting-page browser reload, M5 first calls `/next`. If the
response has `reusedOpenBallot = true`, it resolves that Ballot as `SKIP`, then calls `/next` again and
renders the new pair. If the first call already issued a new Ballot because the previous one expired
or was resolved, the UI must not Skip the newly issued Ballot.

Do not expose `SUSPICIOUS` or risk reason codes before resolution; doing so gives
an attacker a feedback oracle. The response may distinguish normal eligible
quota from ordinary post-quota throttling so the quota notice remains honest.
If an internally suspicious Ballot is still issued, its pre-resolution public
`rankingMode` is indistinguishable from `ELIGIBLE`.

### Errors

- `503 NO_ACTIVE_EDITION`
- `503 POOL_NOT_READY`
- `429 INFRASTRUCTURE_RATE_LIMITED`
- `403 ORIGIN_REJECTED`

## 11.2 `POST /api/v1/ballots/{publicId}/resolve`

### Body

```json
{
  "choice": "LEFT"
}
```

Allowed values:

```text
LEFT
RIGHT
SKIP
```

The client never submits arbitrary player IDs.

### Required transaction behavior

1. Begin a PostgreSQL transaction at `READ COMMITTED`.
2. Select the Ballot by public ID with `FOR UPDATE`.
3. Confirm it belongs to the current visitor.
4. If already `RESOLVED`:
   - do not mutate any score;
   - return the original resolution and current aggregate result;
   - set `alreadyResolved = true`.
5. For an `OPEN` Ballot, confirm the Edition is still `ACTIVE`. If it is not,
   mark the Ballot `EXPIRED` and return `409 EDITION_NOT_ACTIVE` without creating
   a Vote.
6. If expired by time:
   - mark `EXPIRED` if still open;
   - commit;
   - return `410 BALLOT_EXPIRED`.
7. Validate `LEFT`, `RIGHT`, or `SKIP` against the stored Ballot.
8. Map Ballot eligibility to Vote status:
   - `ELIGIBLE -> VALID`
   - `THROTTLED -> THROTTLED`
   - `SUSPICIOUS -> SUSPICIOUS`
9. Insert exactly one Vote. `vote.ballot_id` is unique.
10. Update observed PairAggregate counters for every resolved vote.
11. If Vote is `VALID`:
    - for `SKIP`, increment counted PairAggregate skip and both player-ranking skip counters;
    - otherwise lock both `player_ranking` rows in ascending `player_id` order;
    - increment winner score and wins;
    - decrement loser score and increment losses;
    - update counted PairAggregate winner counter.
12. Update `visitor_daily_usage` resolution counters using the Ballot's persisted
    `usage_date`.
13. Mark Ballot `RESOLVED`, store resolution and timestamp.
14. Commit.
15. After commit, query current ranks/scores and return the response.

All score and aggregate changes must occur in the same transaction as Vote creation and Ballot resolution.

### Idempotency behavior

`ballot.public_id` is the natural idempotency key.

- Same Ballot, same repeated choice: return success with `alreadyResolved = true`.
- Same Ballot, different repeated choice: return `409 BALLOT_ALREADY_RESOLVED` and the original stored choice; do not mutate.
- Network retries may return newer community percentages, but the ranking effect remains exactly once.

### Response example

```json
{
  "resolution": {
    "choice": "LEFT",
    "voteStatus": "VALID",
    "counted": true,
    "alreadyResolved": false
  },
  "headToHead": {
    "leftWinPercent": 0.528,
    "rightWinPercent": 0.472,
    "countedDecisions": 18392,
    "countedSkips": 831
  },
  "left": {
    "rank": 2,
    "score": 842,
    "wins": 10020,
    "losses": 9178
  },
  "right": {
    "rank": 1,
    "score": 917,
    "wins": 10411,
    "losses": 9494
  }
}
```

For a throttled vote, the response must clearly say `counted: false` while still showing the community result.

`leftWinPercent` and `rightWinPercent` are nullable when `countedDecisions = 0`.
The UI renders that state as “暂无有效对决” and still shows counted skips. For a
small sample, show the decision count and a neutral “样本较少” label; display raw
whole-number percentages without statistical smoothing or false decimal precision.

## 11.3 Read APIs

### `GET /api/v1/rankings`

- Default to active Edition.
- Return all active and historically admitted players in that Edition.
- Include tied rank semantics.
- Short public cache is allowed; vote APIs are never cached.

### `GET /api/v1/players/{slug}`

Return profile, ranking, current team, statistics, and freshness.

### `POST /api/v1/product-events`

Accept only an allowlisted event type and small validated metadata. Product analytics must never influence ranking.

---

# 12. Atomicity and concurrency invariants

These are mandatory.

1. One visitor and Edition can have at most one `OPEN` Ballot.
2. One Ballot can produce at most one Vote.
3. One valid non-skip Vote changes exactly two ranking rows: one `+1`, one `-1`.
4. Winner and loser updates commit together or neither commits.
5. PairAggregate and Vote commit together with ranking changes.
6. Retrying a resolved Ballot never changes score again.
7. Ranking rows are always locked in ascending player ID order.
8. Pool changes never rewrite historical Ballots or Votes.
9. A disabled player cannot enter new Ballots after active-pool cache invalidation,
   but an already issued Ballot remains resolvable until expiry while its Edition
   remains active.
10. A non-active Edition cannot issue or resolve a Ballot.
11. Edition score sum is always zero.

Use PostgreSQL row locks and unique/partial unique indexes, not only application-level `if` checks.

Implement a small transaction retry wrapper for PostgreSQL deadlock/serialization error codes with a maximum of three attempts and jitter. The normal design should prevent most deadlocks; retries are a safety net, not the primary concurrency mechanism.

---

# 13. Random-pair service

## 13.1 Active pool cache

The pool contains roughly 100 players, so load active player IDs into a small in-process cache.

- Cache key: Edition ID.
- TTL: short and configurable, e.g. 60 seconds.
- Explicit invalidation after admin Pool changes.
- Database fallback when cache is empty.
- At least two active players are required.

## 13.2 Randomness

Use Node’s cryptographic random API rather than `Math.random()`.

Algorithm:

1. Select a random index from `[0, N)`.
2. Select a random index from `[0, N-1)` and map it so it cannot equal the first.
3. Canonicalize stored IDs.
4. Flip a random bit for left/right order.

Do not send the active ID list to the client.

---

# 14. Daily quota and Ballot expiration

## 14.1 Quota

Initial configuration:

```text
edition.full_weight_ballots_per_day = 50
Time zone = Asia/Shanghai
```

- Ballots 1–50: `ELIGIBLE`, unless risk enforcement marks them suspicious.
- Ballots 51+: `THROTTLED`.
- The user may continue playing indefinitely.
- Throttled votes are stored and can display results, but do not change score or counted H2H.
- The UI must show a small, honest notice when the effective ranking quota has been exhausted.

The quota is assigned at Ballot issuance. Crossing midnight after issuance does not change that Ballot’s eligibility.

## 14.2 Skip and abandonment

- Skip consumes a Ballot opportunity.
- A manual voting-page refresh resolves the current open Ballot as a normal auditable Skip, then
  issues a new Ballot. The old opportunity is not refunded and the new Ballot consumes the next
  ordinal.
- Closing the page consumes the issued opportunity.
- An expired Ballot does not refund the ordinal.

## 14.3 Expiration

Initial TTL:

```text
edition.ballot_ttl_minutes = 30
```

- A normal revisit or transport retry before expiry receives the same open Ballot.
- A true manual voting-page reload is the explicit exception: after M4/M5, the client resolves the
  reused Ballot as Skip and requests a new one. The server does not infer reload from duplicate
  `/next` calls.
- `/next` marks an expired open Ballot `EXPIRED` before issuing another.
- Resolving an expired Ballot returns `410` and does not create a Vote.
- A cleanup job may batch-mark old open Ballots as expired, but correctness cannot depend on the cleanup job.

---

# 15. Anti-abuse design

## 15.1 Principles

- IP is a risk signal, never the primary user identity.
- Shared campus, office, home, internet-café, and carrier NAT addresses must not be punished with a low per-IP vote cap.
- Cloudflare is optional and not part of ranking correctness.
- Turnstile is not used in V0.1 because it is not reliably supported for Mainland China visitors.
- Anti-abuse decides whether a Vote is counted; it never applies fractional score weight.

## 15.2 Infrastructure rate limiting

This protects application availability and is separate from ranking quota.

Implement an in-process bounded token-bucket or sliding-window limiter suitable for the initial single web instance. The limiter must use a bounded TTL/LRU structure to avoid memory leaks.

Suggested initial configurable limits, subject to closed-beta tuning:

```text
/ballots/next:     30 requests/minute/visitor
/resolve:          60 requests/minute/visitor
all public API:   300 requests/minute/IP-risk-key
```

Cloudflare WAF/rate limiting may add an outer layer when proxying is enabled.

A limiter reset after process restart is acceptable. It never determines business truth.

## 15.3 IP risk key

Never store raw IP.

Create a daily risk key:

```text
HMAC-SHA256(
  IP_HMAC_SECRET,
  usage_date + "|" + normalized_ip
)
```

- Normalize IPv4 addresses consistently.
- Aggregate IPv6 at an appropriate prefix such as `/64` before HMAC to reduce privacy-address churn.
- Rotate the date component daily so the stored key is not a permanent cross-day identifier.
- Do not log the input IP.
- Null `issued_ip_risk_key` and `ip_risk_key` after the configured retention
  window (initially 90 days). Raw Votes and aggregate history remain; the
  pseudonymous network signal does not remain forever merely because Votes do.

## 15.4 Proxy modes

```text
CLIENT_IP_MODE=railway
```

Use Railway’s trusted `X-Real-IP` header at the application boundary.

```text
CLIENT_IP_MODE=cloudflare
```

Use `CF-Connecting-IP` for risk aggregation when the domain is proxied. Because Cloudflare is not a hard security dependency, a spoofed/bypassed IP signal must never enable more than the per-visitor quota already permits.

## 15.5 Risk engine

Implement risk collection in V0.1, but start closed beta with:

```text
RISK_ENFORCEMENT_MODE=observe
```

Collect reason codes such as:

- abnormal new-visitor churn for one daily IP key;
- extremely high request velocity;
- repeated invalid Ballot ownership attempts;
- systematic replay/mismatch patterns;
- impossible client flow.

During observe mode, record the would-be decision without changing valid votes, except for explicit integrity failures and daily throttling.

After reviewing real shared-network traffic, the owner may switch selected high-confidence rules to enforcement. Thresholds remain configuration, not code constants.

## 15.6 Vote statuses

```text
VALID       -> stored; score changes
THROTTLED   -> stored; no score change
SUSPICIOUS  -> stored; no score change
REVOKED     -> originally valid; score effect reversed by audited transaction
```

No `0.01` votes.

## 15.7 Revoke workflow

Never delete a Vote.

A revoke transaction must:

1. Lock the Vote and Ballot.
2. Confirm the Vote is currently `VALID`.
3. For non-skip Votes, reverse winner/loser ranking counters and score.
4. Reverse counted PairAggregate.
5. For skip, reverse counted PairAggregate skips and both player-ranking skip
   counters.
6. Change status to `REVOKED` with actor, timestamp, and reason.
7. Write a Moderation Audit Log.
8. Commit atomically.
9. Re-check Edition score sum.

Observed raw counters may remain as records of traffic; public counted counters must be corrected.

---

# 16. Browser security

## 16.1 Same-origin architecture

Serve UI and API from the same origin:

```text
https://example.com/
https://example.com/api/v1/...
```

Do not create a separate public API subdomain in V0.1.

## 16.2 CSRF protections

For every browser mutation endpoint:

- Require `POST`.
- Validate `Origin` against `APP_ORIGIN` in production.
- Reject `Sec-Fetch-Site: cross-site`.
- Use `SameSite=Lax` for visitor cookie.
- Use `SameSite=Strict` for admin session cookie.
- Do not accept form-encoded mutation requests; require JSON with correct content type.

This guard is shared infrastructure introduced in Milestone 0 and is mandatory
when each public/admin mutation route is added. Milestone 8 hardens and audits
the controls; it does not postpone basic CSRF protection until after voting and
Admin already exist.

## 16.3 Security headers

Set, test, and document:

- Content-Security-Policy with `default-src 'self'` and minimal exceptions.
- `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- HSTS in production after HTTPS/domain validation.
- Admin pages: `noindex, nofollow`.

## 16.4 Logging hygiene

Structured JSON logs may include:

- request ID;
- hashed visitor database ID or non-secret internal ID;
- Ballot public ID;
- Vote status;
- route;
- latency;
- error code.

Never log:

- raw visitor cookie;
- raw IP;
- admin session token;
- password;
- database credentials;
- complete external HTML bodies in production logs.

---

# 17. Public UI specification

## 17.1 Navigation

V0.1 public navigation:

- Vote
- Ranking
- About

A Player page is reached from ranking/player links and does not need a top-level tab.

## 17.2 Vote page

Desktop:

```text
[ Player Left card ]   VS   [ Player Right card ]
```

Mobile:

- responsive stacked or compact two-column layout based on viewport;
- both choices remain equally prominent;
- no desktop-only functionality.

Default Player card fields:

- photo;
- nickname;
- country;
- current team;
- recent three-month Rating and map count;
- career Rating when a stable source/definition is available;
- data freshness timestamp.

Detailed-data expansion may show available fields such as:

- ADR;
- KAST;
- additional map count/context;
- recent event participation;
- source label.

Missing statistics render as `—`, never `0`.

Buttons:

- entire left card is selectable;
- entire right card is selectable;
- separate subdued **Skip** button;
- keyboard focus and activation supported.

## 17.3 Post-vote state

Keep the same two cards on screen and show:

- the visitor’s selection;
- whether the vote counted;
- counted H2H percentages;
- counted H2H decisions;
- counted skips;
- current rank and score for both players;
- explicit **Next** button.

Do not auto-advance.

If throttled:

> 今日影响社区榜的有效投票额度已用完。你仍然可以继续投票和查看结果。

## 17.4 Ranking page

- Render all Pool players for the Edition.
- Tied rank display.
- Search/filter by nickname or team may be client-side because the Pool is small.
- Show admission badges only on detailed/admin contexts; do not visually imply score weight differences.
- Freshness and Edition status clearly visible.

## 17.5 About page

Keep it short and direct:

- two players appear;
- pick one or skip;
- valid winner `+1`, loser `-1`;
- no complex formula;
- no objective-truth claim;
- some high-frequency or abnormal votes may not count;
- Candidate Pool rules link;
- data-source attribution link;
- privacy link.

The Privacy page must state the anonymous-cookie purpose, quota/risk processing,
retention windows, analytics categories, external data attribution, and a contact
path for privacy or image-rights/takedown requests. Final legal wording and the
contact address are launch blockers, not Milestone 0 blockers.

## 17.6 Accessibility

- Semantic buttons rather than clickable divs.
- Full keyboard flow.
- Visible focus states.
- Alternative text for player images.
- Color must not be the only result indicator.
- Minimum WCAG AA contrast target.
- Reduced-motion support.

---

# 18. Admin design

## 18.1 Authentication

- No public registration.
- One or more manually created admin users.
- Password hash: Argon2id through a maintained library.
- Session token: random opaque token, hash stored in `admin_session`.
- Admin cookie: `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`.
- Session lifetime configurable; initial target 12 hours.
- Login attempts rate-limited.

Create the first user with:

```text
pnpm admin:create
```

## 18.2 Required admin screens

1. Dashboard: active Edition, pool size, integrity status, last sync.
2. Players: create/edit, external identities, image path, status.
3. Teams and rosters.
4. Editions.
5. Candidate Pool team entries.
6. Candidate Pool player entries.
7. Pending imported changes.
8. Event whitelist.
9. Pool Change Log.
10. Vote moderation/revoke search.
11. Sync history and parser failures.

## 18.3 Change behavior

- All Pool changes write a log.
- Disabling pairing invalidates active-pool cache.
- Changes take effect without code changes or redeployment.
- No public data row is physically deleted through the admin UI.
- Importer suggestions require explicit approval.

---

# 19. External data strategy

## 19.1 Source ownership

### HLTV

Use for data that has no practical equivalent, especially:

- HLTV Rating displayed as HLTV Rating;
- HLTV Team Ranking;
- selected player/team profile fields;
- HLTV event-highlight reference.

HLTV does not provide a supported public API for this project. Implement a narrow, replaceable adapter and low-frequency HTML parser.

Rules:

- Never fetch HLTV in a user request path.
- Never bypass access controls, anti-bot systems, or blocking.
- Keep request concurrency at one unless explicitly reviewed.
- Add delay, caching, retry with backoff, and a circuit breaker.
- If blocked or parser fails, keep serving stale database data.
- Store data freshness and parser version.
- Use saved HTML fixtures in tests.

### Valve VRS

Use the official Valve regional-standings repository/data for VRS snapshots.

### Liquipedia / commercial APIs / GRID

Optional reference or future providers. V0.1 must not require them to stay online.

## 19.2 Provider interface

Example:

```ts
interface PlayerStatsProvider {
  fetchPlayerStats(identity: ExternalIdentity): Promise<NormalizedPlayerStats>;
}

interface TeamRankingProvider {
  fetchRanking(capturedAt: Date): Promise<NormalizedTeamRanking[]>;
}
```

UI and ranking code never parse provider HTML.

## 19.3 Sync schedules

Initial configurable cadence:

- Player recent stats: daily, low-frequency batch.
- HLTV ranking: weekly or when a new ranking is published.
- Valve VRS: weekly or when a new snapshot is published.
- Roster verification: daily/weekly plus manual trigger.
- Candidate Pool calculation: creates draft/pending changes only.

## 19.4 Candidate Pool draft command

```text
pnpm pool:build-draft --edition 2026
```

Required stages:

1. Load latest approved HLTV snapshot.
2. Load latest approved VRS snapshot.
3. Compute Core Top 12 union.
4. Evaluate Top 20 + Event results for Review Auto.
5. Apply configured Review Manual teams.
6. Apply Special players.
7. Resolve current formal starting five.
8. Output additions, removals, roster conflicts, missing identities, and source freshness.
9. Save changes as `PENDING`; do not apply them.
10. Admin approves individual or batch changes.

The command reads the latest **approved** source snapshots. If a required source
is missing, older than a configured freshness threshold, or disagrees on roster
identity, the affected proposal is emitted as a conflict and cannot be batch
approved. Existing approved Manual/Special entries are inputs from the database,
not hidden configuration in source code.

## 19.5 Images and rights

V0.1 player photos and team logos are local static assets.

- No runtime hotlinking.
- Keep `assets/attribution.json` with source/license/permission notes.
- Provide a neutral placeholder when an image cannot be used.
- Do not copy third-party image assets merely because their pages are publicly accessible.

---

# 20. Scheduled jobs

Use Railway scheduled services built from the same repository.

Required commands:

```text
pnpm job:snapshot-ranking
pnpm job:integrity-check
pnpm job:expire-ballots
pnpm job:sync-hltv
pnpm job:sync-vrs
pnpm job:build-pool-draft
```

## 20.1 Daily ranking snapshot

- Compute tied ranks using `RANK()`.
- Upsert one snapshot per Edition/date/player.
- Idempotent for the same date.

## 20.2 Integrity check

At minimum:

- Edition score sum equals zero.
- Each ranking score equals wins minus losses.
- No Ballot has more than one Vote.
- No visitor has more than one open Ballot per Edition.
- PairAggregate counted totals match valid non-revoked Votes for sampled or full ranges.
- No ranking row missing for a Pool player.
- No raw IP-shaped values in risk-key columns/log samples.

Failure must produce a non-zero job exit code and an error alert.

## 20.3 Expiration cleanup

Batch-mark old open Ballots expired. The public `/next` endpoint remains correct even if the job has not run.

---

# 21. Analytics and product metrics

The product must answer these without a third-party analytics dependency:

- Ballots issued per visitor.
- Valid decisions per visitor.
- Skip rate overall and by player.
- Percentage of Ballots resolved.
- Ranking-page view rate after voting.
- Next-click rate.
- Repeat visitors by local date.
- Throttled percentage.
- Parser/data freshness.
- Vote API latency and error rate.

Raw product events may be retained for an initial 90-day window, then aggregated or purged. Votes and ranking history have a separate retention policy and are preserved.

The same cleanup framework nulls expired daily IP-risk keys while retaining the
non-network Vote record. Retention jobs are idempotent, observable, and covered
by tests.

Do not use an external analytics script that materially slows or fails for Mainland China users in V0.1.

---

# 22. Observability

## 22.1 Logging

Use structured logging, preferably Pino or an equivalent small maintained library.

Every request gets a request ID.

Log categories:

- HTTP request summary;
- Ballot issuance/resolution outcome;
- transaction retry;
- risk reason codes;
- admin change;
- external sync;
- scheduled job result;
- integrity failure.

## 22.2 Error tracking

An external error tracker such as Sentry is optional but recommended if it works acceptably for the deployment. The application must still work when the tracker is unavailable.

## 22.3 Health endpoints

```text
GET /api/health/live
GET /api/health/ready
```

- `live`: process is running.
- `ready`: startup configuration is valid and the application can execute a
  lightweight PostgreSQL query such as `SELECT 1`.
- Do not expose secrets or detailed database state.

Edition/pool availability is reported separately in Admin/integrity status and
by explicit `NO_ACTIVE_EDITION` / `POOL_NOT_READY` API errors. A planned DRAFT or
FROZEN Edition must not make an otherwise healthy deployment fail readiness.

---

# 23. Testing strategy

## 23.1 Unit tests: Vitest

Required areas:

- Candidate Pool rule evaluation.
- T1 Event whitelist logic.
- random distinct-player selection.
- canonical pair ordering.
- left/right randomization mapping.
- quota date and ordinal behavior.
- risk-status mapping.
- ranking tie behavior.
- score-reversal logic.
- empty and small-sample H2H presentation semantics.
- provider normalization/parsing using fixtures.
- configuration validation.

## 23.2 Integration tests: real PostgreSQL

Do not use SQLite as a substitute.

Required concurrency tests:

1. Two simultaneous `/next` operations for one visitor create one open Ballot.
2. Repeated transport-level `/next` returns the same Ballot and does not consume another ordinal.
3. One hundred concurrent resolves of one Ballot create exactly one Vote effect.
4. Two different choices racing on the same Ballot produce one stored result only.
5. A forced exception between winner and loser updates rolls back everything.
6. A forced exception after Vote insert rolls back Vote and ranking changes.
7. Ballot 51 is throttled and does not change score.
8. Skip consumes the ordinal but changes no score.
9. Expired Ballot consumes its original ordinal and cannot resolve.
10. Revoke exactly reverses counted ranking and PairAggregate.
11. Score sum remains zero after randomized valid votes and revocations.
12. Disabling a player prevents new Ballots after cache invalidation but preserves old records.
13. New Pool player gets a ranking row at zero without a deployment.
14. Partial unique index rejects a second open Ballot even if application checks are bypassed.
15. `vote.ballot_id` unique constraint rejects duplicate Vote insertion.
16. A valid skip revoke decrements both player skip counters and counted PairAggregate skip.
17. A Ballot issued before Shanghai midnight updates resolution counters on its issuance `usage_date`.
18. Leaving `ACTIVE` expires open Ballots, rejects new effects, and preserves idempotent reads of resolved Ballots.
19. Active-Edition and current-roster partial unique constraints reject conflicting rows.
20. A stale/conflicting pending import cannot be blindly approved.
21. Zero counted H2H decisions return null percentages without division by zero.

## 23.3 End-to-end tests: Playwright

At minimum:

```text
first visit
 -> visitor cookie set
 -> Ballot rendered
 -> details expand/collapse
 -> choose player
 -> result rendered
 -> no auto-next
 -> click Next
 -> new Ballot rendered
 -> manually refresh voting page
 -> reused open Ballot resolves as exactly one SKIP
 -> new Ballot with the next ordinal renders directly
```

Additional E2E:

- Skip.
- Network retry or duplicate `/next` without a browser reload preserves the current Ballot.
- Reload retry creates at most one Skip Vote and one subsequent open Ballot.
- Throttled notice.
- Ranking page.
- Player page.
- Admin login and Pool toggle.
- Keyboard-only voting.
- Mobile viewport.
- Production cookie attributes (`__Host-`, Secure, HttpOnly, Path, no Domain).

## 23.4 Provider tests

- CI uses saved HLTV/VRS fixtures.
- A parser change must add/update fixtures and explicit field assertions.
- Network failure returns a controlled job failure and leaves existing data intact.

## 23.5 Performance/load tests

Before public launch:

- 100 concurrent resolves against the same Ballot: exactly one effect.
- Distinct-Ballot voting load sufficient to establish transaction p95 under a realistic staging workload.
- Ranking page/query under repeated reads.
- External sync cannot starve the web connection pool.

Use a separate small DB pool for scheduled sync processes if necessary.

---

# 24. CI and code quality

## 24.1 Required scripts

```text
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:check
```

## 24.2 Pull-request CI

```text
install locked dependencies
 -> lint
 -> formatting check
 -> TypeScript typecheck
 -> unit tests
 -> start PostgreSQL service
 -> apply migrations to empty DB
 -> integration tests
 -> production build
```

E2E may run on main or selected PRs if resource cost is significant, but must run before deployment.

## 24.3 Coding rules

- TypeScript strict mode.
- Avoid `any`; justified boundary casts must be localized.
- Every external request and HTTP body validated by Zod.
- Domain services do not import Next.js modules.
- Critical SQL is explicit and commented with the invariant it protects.
- No production `db push`; only reviewed committed migrations.
- No hidden candidate lists in source code.
- No live-network test dependency.
- No TODO without an owner issue or explicit plan note.

---

# 25. Deployment and infrastructure

## 25.1 Railway

Production services in Singapore:

```text
web       Next.js Docker service
postgres  PostgreSQL with persistent volume
cron-*    scheduled commands from same repository
```

- Web and PostgreSQL communicate on Railway private networking.
- PostgreSQL is not publicly exposed for normal application traffic.
- Run migrations as a controlled release step before the new app serves traffic.
- A failed migration blocks deployment.
- Keep at least one tested database backup strategy.

## 25.2 Docker

Use a multi-stage Dockerfile:

1. Node 24 LTS base.
2. Install exact pnpm and frozen lockfile.
3. Build Next.js in standalone mode.
4. Run as non-root user.
5. Read `PORT` from environment.
6. Include only production runtime files in final stage.

Local development uses `docker-compose.yml` for PostgreSQL; running the web app directly with pnpm is acceptable.

## 25.3 Cloudflare

Cloudflare is an optional edge enhancement, not an application dependency.

When the owner selects a custom domain and a Cloudflare experiment, use this process:

1. Deploy Railway Singapore.
2. Create two pre-launch test hostnames:
   - Cloudflare proxy on;
   - direct/DNS-only path.
3. Test Mainland China Telecom, Unicom, and Mobile where possible.
4. Compare page load, `/next`, `/resolve`, p50/p95, failure rate, and evening-peak behavior.
5. Keep proxy enabled only if it helps or is neutral.

The application must work with Cloudflare completely disabled.

The Owner's V0.1.3 low-cost path may launch the initial small closed beta directly on Railway's
generated HTTPS hostname. In that mode, record Cloudflare/custom-domain testing as deliberately
deferred, continue direct-route security/load/Mainland China checks, and reopen the A/B decision
when ADR 0005's traffic, abuse, cost, branding, or routing trigger occurs.

Because production mutation security allows one `APP_ORIGIN`, proxy-on and direct
mutation tests run as two separately configured staging deployments or as
sequential test windows with an explicit origin change. Do not weaken Origin
validation by accepting both hostnames indefinitely in one production process.

Do not use Turnstile in V0.1.

## 25.4 Backup and recovery

Before launch:

- Keep at least one retained, tested backup strategy appropriate to the active Railway plan.
- On Hobby under ADR 0004, create scheduled portable `pg_dump` backups, keep a second independent
  protected copy before real public launch, and document the accepted RPO/RTO.
- When platform volume backups/PITR are available and justified, enable them in addition to—not as a
  replacement for—the portable logical procedure.
- Perform and document at least one restore drill into a separate database.
- Record recovery steps in `docs/RUNBOOK.md`.
- Backups are not considered verified until a restore succeeds.

## 25.5 Cost controls

- Configure Railway spending alerts.
- Keep Cloudflare optional.
- Do not run external-data sync loops continuously.
- Do not serve large unoptimized images from Railway.
- Inspect Web and DB memory/CPU after closed beta.

---

# 26. Data migration and seed strategy

## 26.1 Initial seed

Development seed includes:

- one DRAFT Edition;
- 10 fictional or clearly marked test players;
- two or three teams;
- sample roster memberships;
- sample statistics;
- sample Pool entries.

Do not put inaccurate real-player data into a committed development seed as if it were authoritative.

## 26.2 Production Candidate Pool V1

Generate during implementation using the approved rule engine and fresh sources.

Required output:

- Core teams;
- Review Auto teams and qualifying result;
- Review Manual teams and reason;
- Special players and reason;
- resolved starting five;
- unresolved source conflicts;
- missing player photos/stats;
- total player count and pair count.

The owner reviews and approves the production set before the Edition becomes ACTIVE.

---

# 27. Milestone plan

Each milestone must finish with:

- code;
- migrations if applicable;
- tests;
- updated docs;
- exact commands run;
- known limitations;
- owner-review summary.

## Milestone 0 — Repository and runtime foundation

Tasks:

- Initialize Next.js App Router TypeScript project.
- Pin Node 24 LTS and pnpm.
- Add Tailwind, Zod, Drizzle, node-postgres, Vitest, Playwright.
- Configure strict TypeScript, linting, formatting.
- Add Dockerfile and local PostgreSQL compose file.
- Add environment schema and fail-fast startup validation.
- Add basic structured logger and request IDs.
- Add reusable JSON content-type, Origin, and Fetch-Metadata mutation guards.
- Add liveness/readiness endpoints.
- Add GitHub Actions baseline.
- Create documentation skeleton and ADR template.

Acceptance:

- Fresh checkout can install with frozen lockfile.
- `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, and `pnpm build` pass.
- Docker production build starts.
- Readiness fails when DB is unavailable and succeeds when connected.

### Owner Review Gate A

Review repository shape, dependencies, Docker, CI, and configuration before schema implementation.

## Milestone 1 — Database schema and invariants

Tasks:

- Implement all V0.1 tables/enums.
- Generate reviewed SQL migrations.
- Add partial unique open-Ballot index.
- Add unique Vote/Ballot constraint.
- Add canonical-pair and counter checks.
- Add database client/pool configuration.
- Add test database lifecycle.
- Add sample development seed.
- Implement complete admin/session/audit and pending-import tables.
- Write `docs/DATABASE.md`.

Acceptance:

- Empty database migrates successfully.
- Schema constraints are directly tested.
- Duplicate open Ballot and duplicate Vote are rejected at DB level.
- Development seed is repeatable/idempotent.

### Owner Review Gate B

Review migration SQL and data model before implementing voting transactions.

## Milestone 2 — Candidate Pool domain and dynamic management core

Tasks:

- Implement Edition, Team, Player, Roster, Event, Pool services.
- Implement Core and Review Auto rule evaluator.
- Implement manual and Special admission paths.
- Implement Pool Change Log.
- Implement active-pool cache and invalidation.
- Provide CLI commands to add/disable players before Admin UI exists.
- Initialize ranking row at zero on admission.

Acceptance:

- Add a Player without changing code or redeploying.
- Disable pairing while retaining history.
- Rule engine unit tests cover Top 12, Top 20/event result, Major, manual, and Special paths.
- Admission category has no effect on pairing probability or score.

## Milestone 3 — Anonymous visitor and Ballot issuance

Tasks:

- Implement secure visitor cookie and token hash.
- Implement visitor creation/lookup.
- Implement `visitor_daily_usage` ordinal transaction.
- Implement `POST /ballots/next`.
- Implement one-open-Ballot locking and partial-index fallback.
- Implement expiry behavior.
- Implement uniform random pair selection and left/right randomization.
- Add infrastructure rate limiter shell.
- Apply the shared mutation security guard to the Ballot endpoint.

Acceptance:

- Concurrent next requests return one Ballot.
- Repeated next returns the same Ballot and ordinal.
- Skip/resolve is required to obtain another unexpired Ballot.
- Pair always contains two distinct active players.
- Daily ordinal is based on Asia/Shanghai.

## Milestone 4 — Vote resolution, ranking, and idempotency

Tasks:

- Implement resolve API and Zod body.
- Implement locked/idempotent Ballot transaction.
- Implement valid/throttled/suspicious statuses.
- Implement ranking updates in stable lock order.
- Implement PairAggregate upsert.
- Implement skip behavior.
- Ensure Skip resolution is idempotent for the later manual-refresh workflow.
- Implement repeated-resolve behavior.
- Reject new effects after an Edition leaves `ACTIVE` while preserving idempotent
  reads of already resolved Ballots.
- Implement revoke service and audit log.
- Add score-integrity command.

Acceptance:

- One hundred concurrent resolves create one effect.
- Winner and loser updates cannot partially commit.
- Ballot 51 is stored but does not affect ranking.
- Revoke restores score and counted aggregate.
- `SUM(score) = 0` after all test scenarios.

### Owner Review Gate C

Review transaction SQL, concurrency tests, API responses, and quota behavior. Do not build public UI on an unapproved voting core.

## Milestone 5 — Public vertical slice

Tasks:

- Build responsive Vote page.
- Build PlayerCard and detailed data expansion.
- Build post-vote result state and explicit Next.
- Detect true voting-page browser reload; when `/next` reuses the open Ballot, resolve it as Skip and
  request the next Ballot without showing the result interstitial.
- Build Ranking page with ties.
- Build Player page.
- Build About and Privacy pages.
- Add missing-data and stale-data states.
- Add keyboard/accessibility support.
- Add Playwright core journey.

Acceptance:

- Full anonymous journey works on desktop and mobile.
- No auto-next.
- Manual voting-page refresh is the sole auto-advance exception: it records exactly one Skip and
  renders a newly issued pair.
- Throttled users are informed honestly and can continue.
- API retries and ordinary rerenders preserve the current open Ballot; manual browser reload does
  not.
- Public pages remain functional with stale/missing external stats.

## Milestone 6 — Admin and audit surface

Tasks:

- Implement admin user creation and login/session.
- Implement Team/Player/Roster management.
- Implement Edition and Event whitelist management.
- Implement Pool Team/Player admission.
- Implement pairing enable/disable.
- Implement pending-change approval.
- Implement vote revoke UI.
- Display logs and integrity/sync status.

Acceptance:

- All pool changes occur without deployment.
- Every mutation has actor/reason/audit record.
- No public data can be physically deleted through UI.
- Admin session and mutation CSRF tests pass.

### Owner Review Gate D

Review admin workflows and permission boundary before connecting live provider data.

## Milestone 7 — External data adapters and scheduled jobs

Tasks:

- Implement Valve VRS importer.
- Implement narrow HLTV adapters for approved fields.
- Add fixtures and parser tests.
- Implement PlayerStatSnapshot and ranking snapshot writes.
- Implement sync history and stale fallback.
- Implement Candidate Pool draft generator.
- Implement local asset import/attribution workflow.
- Configure job commands.

Acceptance:

- Provider failure never breaks voting pages.
- CI uses fixtures only.
- Candidate Pool generator produces a reviewable pending report.
- No imported change becomes live automatically.
- Data freshness appears in UI/admin.

## Milestone 8 — Anti-abuse, analytics, and integrity hardening

Tasks:

- Implement daily IP HMAC risk keys.
- Implement bounded infrastructure rate limiter.
- Implement observe-mode risk reason collection.
- Implement analytics event endpoint and KPI queries.
- Implement daily snapshots and integrity checks.
- Audit the already-required mutation guards, add security headers, and add
  retention/cleanup jobs including IP-risk-key nulling.

Acceptance:

- No raw IP stored or logged in tests.
- Clearing visitor cookie does not bypass all monitoring signals.
- Risk enforcement can switch observe/enforce via config.
- Ranking correctness does not depend on Cloudflare.
- Daily KPI report can be generated from first-party data.

## Milestone 9 — Staging deployment and operational readiness

Tasks:

- Deploy Web/Postgres/Cron to Railway Singapore.
- Configure private DB networking.
- Apply migrations through release process.
- Configure a custom staging domain only if the owner selects one; otherwise record the approved
  Railway-generated-host exception.
- Configure optional Cloudflare/direct A/B hostnames only when an owner-controlled domain is in
  scope; otherwise validate the direct path and record the deferral.
- Configure backups, spending alerts, logs, and error tracking.
- Run restore drill.
- Complete `docs/RUNBOOK.md` and `docs/SECURITY.md`.
- Run staging load/concurrency tests.

Acceptance:

- Cloudflare is either disabled without code change or, if enabled, can be removed without code
  change.
- Direct Railway route remains functional.
- Backup restore succeeds.
- Migration failure blocks release.
- Health, logs, jobs, and alerts are verified.

### Owner Review Gate E

Review staging behavior, China-network tests, backup restore, and security checklist before production data.

## Milestone 10 — Candidate Pool V1, closed beta, and launch

Tasks:

- Run fresh Pool draft for 2026.
- Resolve roster/source conflicts.
- Upload approved assets and attribution.
- Owner approves Core, Review Auto, Review Manual, and Special entries.
- Activate Edition.
- Run closed beta with real users from multiple networks/devices.
- Tune quota and infrastructure rate limits using observed data.
- Keep risk engine in observe mode until false-positive analysis is complete.
- Fix launch blockers.
- Freeze launch migration and deploy.

Acceptance:

- Production Pool is fully auditable.
- No unresolved identity/roster conflicts.
- Vote correctness tests pass against production-like staging data.
- The Mainland China launch route has a documented decision; if Cloudflare enters scope, its
  proxy-on/off comparison is documented before relying on it.
- Launch checklist is signed off.

---

# 28. Cross-milestone acceptance matrix

The project is not V0.1 complete until all are true.

## Product

- [ ] Anonymous visitor can start with no login.
- [ ] Pair is server generated.
- [ ] Pair is true uniform random over enabled Pool players.
- [ ] Left/right order is randomized.
- [ ] Valid winner +1, loser -1.
- [ ] Skip changes no score.
- [ ] Score starts at 0.
- [ ] User explicitly clicks Next.
- [ ] Ranking ties are displayed as ties.
- [ ] Candidate Pool is dynamic and audited.

## Correctness

- [ ] One open Ballot per visitor/Edition enforced in DB.
- [ ] One Vote per Ballot enforced in DB.
- [ ] Duplicate resolve has one effect.
- [ ] Winner/loser/aggregate/Vote transaction is atomic.
- [ ] Ballot issuance consumes quota exactly once.
- [ ] Expired and skipped Ballots do not refund quota.
- [ ] Edition score sum equals zero.
- [ ] Vote revocation is atomic and audited.

## Security/privacy

- [ ] Secure HttpOnly visitor cookie.
- [ ] Same-origin mutation checks.
- [ ] No raw IP persistence.
- [ ] No secrets in logs.
- [ ] Admin session is separate and stricter.
- [ ] No Turnstile dependency.
- [ ] Cloudflare can be removed.
- [ ] Infrastructure rate limits do not alter business truth.

## Data

- [ ] HLTV is not a runtime dependency.
- [ ] VRS comes from an official Valve source.
- [ ] Import failures preserve old data.
- [ ] Candidate changes require approval.
- [ ] Data freshness is visible.
- [ ] Images have attribution/permission records or placeholders.

## Operations

- [ ] Empty DB migration tested.
- [ ] Production backup enabled.
- [ ] Restore drill completed.
- [ ] Integrity job scheduled.
- [ ] Daily snapshot scheduled.
- [ ] Railway spending alerts configured.
- [ ] China network launch-route test documented; Cloudflare A/B is required only when selected.
- [ ] Runbook complete.

---

# 29. Decisions agents are forbidden to make autonomously

An implementation agent must ask for owner approval before:

- changing `+1/-1` ranking;
- changing true random pairing;
- weighting pairs or votes;
- requiring login;
- merging Candidate Pool admission categories into ranking logic;
- automatically removing players from an Edition;
- automatically approving imported pool changes;
- adding Redis, a queue, a second backend, GraphQL, or microservices;
- making Cloudflare required;
- adding Turnstile or another mandatory CAPTCHA;
- changing hosting provider/region;
- hotlinking images;
- circumventing external-site access controls;
- physically deleting Votes;
- changing the daily quota semantics from Ballots issued to Votes submitted;
- auto-advancing after a vote;
- adding Event MVP to V0.1.

---

# 30. Owner decisions that may remain placeholders during early milestones

These do not block Milestones 0–5:

- final product name;
- final domain;
- exact visual identity;
- exact launch Candidate Pool;
- exact manual Review teams;
- exact Special Inclusion players;
- final list of T1 events already completed in 2026;
- final full-weight quota after closed beta;
- final player-photo licensing/source choices;
- whether Cloudflare is introduced after ADR 0005's trigger and, if so, remains proxied after
  China-network testing.

---

# 31. Post-V0.1 roadmap hooks

Store the data required for, but do not implement yet:

- dedicated H2H pages;
- ranking trend charts;
- annual Community Top 20 editorial page;
- event-specific Editions/MVP voting;
- personal ranking/account system;
- verified Steam votes;
- geographic/community-segment comparisons;
- shareable result cards;
- advanced moderation dashboards;
- Redis caching and multiple web replicas;
- raw Vote partitioning/archival.

---

# 32. Official technical references

Use current official documentation during implementation and pin exact dependency versions in the lockfile.

- Node.js release status: https://nodejs.org/en/about/previous-releases
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js Node runtime: https://nextjs.org/docs/app/api-reference/edge
- Next.js Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest
- Next.js Playwright guide: https://nextjs.org/docs/app/guides/testing/playwright
- Drizzle PostgreSQL: https://orm.drizzle.team/docs/get-started-postgresql
- Drizzle transactions: https://orm.drizzle.team/docs/transactions
- PostgreSQL explicit locking: https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL partial indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- PostgreSQL INSERT / ON CONFLICT: https://www.postgresql.org/docs/current/sql-insert.html
- Railway regions: https://docs.railway.com/deployments/regions
- Railway request headers: https://docs.railway.com/networking/public-networking/specs-and-limits
- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway backups: https://docs.railway.com/volumes/backups
- Railway PostgreSQL backup/restore guide: https://docs.railway.com/guides/postgres-backups-restores
- Cloudflare Mainland China / Turnstile support: https://developers.cloudflare.com/china-network/faq/
- Valve VRS repository: https://github.com/ValveSoftware/counter-strike_regional_standings
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP API Security: https://owasp.org/API-Security/

---

# 33. Definition of done

V0.1 is done when a new anonymous visitor in production can receive a server-randomized Ballot, cast an exactly-once valid or non-counting choice, see the community result, deliberately request the next Ballot, inspect a trustworthy auditable ranking, and continue using the site even when external data providers or Cloudflare are unavailable—while the owner can change the Candidate Pool without editing code or losing history.
