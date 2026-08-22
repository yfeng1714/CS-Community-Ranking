# HLTV Player Stats — capture and import playbook

This is the operational path for updating public HLTV player data. Future agents should follow it
instead of inventing a live adapter, scraping `/stats/players/`, or filling Rating from Liquipedia
or BO3.

Public requests never fetch HLTV. Keep `HLTV_SYNC_ENABLED=false`. Never run this capture from CI.

## What the site actually displays

Vote cards:

- default: past-3-month **Rating 3.0** labeled **近三月 Rating 3.0**, plus **火力值** (`N/100`).
  If that Rating is missing and an Owner-reviewed **生涯 Rating** exists, the same slot uses that
  label and value. If both are missing, the slot stays **近三月 Rating 3.0** / `—`;
- identity line: **Majors won** and **Total MVPs** when captured (`2 Major · 32 MVP`; zeros are
  shown; omit the line only when both values are missing);
- nationality from `player.country_code` (ISO-2 from the profile flag; missing stays `国籍待补`);
- details: **highest HLTV Top 20** (peak rank and every year at that rank) + **maps**.

Player pages show the same fields. Missing values render as `—`. Do not invent career Rating from
Liquipedia or BO3. Retired Special players without Past 3 months activity may receive an
Owner-reviewed `career_rating` / `CAREER` snapshot. Those values are frozen: do not recapture or
re-import them on later HLTV stats passes. `pnpm pool:admit-special-retired` writes the same
snapshots from `data/review-manual/special-retired-2026-08-17.json` (MachineWJQ `0.78`, advent
`0.85`). The standalone file `data/review-manual/career-ratings-2026-08-17.json` matches that set.

Skip on the Vote result panel uses the heading **已跳过**, not “这一票已计入社区榜”.

## What HLTV player profiles currently expose

Capture loads `https://www.hltv.org/player/{id}/{slug}` in local Playwright Chromium. Parser
`hltv-player-profile-stats-html-v3` reads:

| Field | Source on `/player/{id}/{slug}` | Stored as |
| --- | --- | --- |
| Past 3 months Rating 3.0 | `.player-stat` / `.statsVal` | `player_stat_snapshot.metric = rating_3_0` / `LAST_3_MONTHS` |
| Past 3 months maps | `(Past 3 months • N maps)` | `maps` on the rating snapshot |
| Firepower | `.player-stat` Firepower `N` | `firepower` / `LAST_3_MONTHS` |
| Majors won | `.highlighted-stat` **Majors won**, else `.majorWinner` (`N x Major winner`) | `majors_won` / `CAREER` |
| Total MVPs | `.highlighted-stat` **Total MVPs** when present, else the visible `.mvp-count` trophy badge | `mvp_count` / `CAREER` |
| Highest Top 20 | `Top 20 overview` table (`#N best player in YY` + year column) | one `top20_rank` / `CAREER` snapshot per year; UI peaks the latest capture |
| Nationality | `.player-summary-stat-box-left-flag` `…/flags/30x20/XX.gif` | `player.country_code` (ISO-2) |

Do **not** treat these as the same thing:

- **Majors played** is not Majors won.
- **Major MVPs** and EVPs are not Total MVPs.
- The profile all-time block is matches / KDR / headshots, **not** career Rating 3.0.
- ADR and **Round Swing** live on `/stats/players/`, which remains Cloudflare-blocked from Node.
  Do not scrape that path, and do not invent either field. Detail stats are therefore Top 20 + maps.
- Do not infer nationality from the current team country.

If a field is not on the page, leave it `null` / empty. Never infer career Rating from recent
Rating, ADR from KDR, Top 20 from news headlines, or honors from a different label.

The reviewed JSON still stores `recentSourceUrl` as the official dated `/stats/players/{id}/{slug}`
URL so identity/period validation stays exact. The HTML that actually loaded is the player profile.

## Storage contract (Railway Postgres)

New fields use the same tables the rest of the product already uses. Do not add a parallel JSON
column or a second stats table.

- **Stats** (Rating, Firepower, honors, Top 20 years) → `player_stat_snapshot`, same as before.
  `metric` is free text; `top20_rank` needs no migration. Each Top 20 year is one CAREER row with
  `period_start = YYYY-01-01` and `period_end = YYYY-12-31`, `value` = that year's rank (1–20).
  Public queries keep only `provider = HLTV`, take the latest `captured_at` group, then pick the
  minimum rank and every year that equals it.
- **Nationality** is identity, not a stat → `player.country_code`. The same import transaction
  overwrites it when the profile flag parsed an ISO-2 code, and records the change on the existing
  `IMPORT_REVIEWED_HLTV_PLAYER_STATS` audit. Missing flags do not clear a previously stored code.
  Canonical `data/canonical/2026-beta.json` `countryCode` may still be null; live reads Postgres.
  A later empty-database bootstrap would need this import again (or an Owner identity edit).

## Local commands

Identity coverage is the union of `data/canonical/2026-beta.json` (70 Core HLTV IDs) and
`--review-manual data/review-manual/2026-08-17.json` (20 Review Manual IDs). Import requires that
bundle to cover every **non-retired pairing-pool** HLTV identity exactly once (90 after the
2026-08-17 Review Manual admission). Event-only Event MVP identities (no `pool_player_entry`) are
not part of this coverage. Retired Special identities (MachineWJQ, advent) are excluded
because their data does not change. Do not invent Rating for the new 20; recapture their official
profiles, then resume into the existing ignored 70-player JSON so Core snapshots stay. The output
JSON is Git-ignored:

`data/reviewed-sources/hltv-player-stats-local.json`

### 1. Capture

```bash
pnpm source:capture-reviewed-hltv-stats -- \
  --start YYYY-MM-DD --end YYYY-MM-DD \
  --review-manual data/review-manual/2026-08-17.json \
  --resume \
  --output data/reviewed-sources/hltv-player-stats-local.json
```

Defaults: period end = today, period start = three months earlier, delay = 8s, one retry 20s after
HTTP 403/429/503, stop after three consecutive denials.

- `--review-manual` unions Owner-reviewed identities with Core. `--resume` then fetches only IDs
  missing from the existing ignored JSON (the 20 Review Manual players when Core 70 are already
  captured for the same `--start`/`--end`). It cannot upgrade a v1/v2 JSON that is missing
  `top20Placements` / `countryCode`; that schema is rejected. Use `--force` for a full recapture
  after a parser/schema bump.
- `--force` overwrites the ignored JSON. Always use a **new** `capturedAt` (the default is `now`).
  Reusing a timestamp already imported into a database is refused.
- `--player-id` is debug-only.
- `--headed` opens a visible browser if Cloudflare is hot.

Roster or identity changes do **not** recapture automatically. After the configured HLTV identity
set changes, recapture (or `--resume` once the new template includes the new IDs) and import again.

### 2. Preview

```bash
pnpm source:preview-reviewed-hltv-stats
```

Writes ignored `data/reviewed-sources/hltv-player-stats-preview.html`. Spot-check Rating, Firepower,
maps, Top 20 peak + years, nationality, Majors, MVPs.

### 3. Dry-run import

```bash
pnpm source:import-reviewed-hltv-stats -- \
  --file data/reviewed-sources/hltv-player-stats-local.json
```

Validates checksum, period, unique IDs, exact official stats URLs, and complete coverage of every
configured HLTV player identity. It does not connect to a database.

### 4. Apply locally

Point `DATABASE_URL` at the intended local database first. Default `.env` may still be the 4-player
seed `csr`; the UI-preview clone is `csr_m10_ui_preview_20260814`. Do not point `.env` at Railway.

```bash
pnpm source:import-reviewed-hltv-stats -- \
  --file data/reviewed-sources/hltv-player-stats-local.json \
  --actor owner --reason "Reviewed official HLTV player profile stats" \
  --apply --confirm-reviewed-stats
```

Apply requires an active Admin, a reason, `--apply`, and `--confirm-reviewed-stats`. One transaction
writes observed snapshots, updates parsed `player.country_code` values, and one Admin audit.

### 5. Apply to Railway (production)

The JSON stays on the operator laptop. `railway run` injects the **private**
`postgres.railway.internal` URL, which does not work from the laptop. Open a private SSH tunnel
instead, then point `DATABASE_URL` at that local URL in a **second** terminal. Do not paste the
tunnel password into chat, commits, or docs.

```bash
railway connect Postgres --environment production --ssh --tunnel-only
```

```bash
DATABASE_URL=<tunnel-url> pnpm source:import-reviewed-hltv-stats -- \
  --file data/reviewed-sources/hltv-player-stats-local.json \
  --actor owner --reason "Reviewed official HLTV player profile stats" \
  --apply --confirm-reviewed-stats
```

Node `--env-file-if-exists=.env` does **not** override an already-set `DATABASE_URL`. The Admin
actor username is `owner`. Close the tunnel when the import finishes. Do not commit the ignored
capture JSON, `.env`, or captured HTML.

Owner-reviewed career Rating for retired Special players without Past 3 months activity
(MachineWJQ `0.78`, advent `0.85`) is a separate committed file. Prefer
`pnpm pool:admit-special-retired`, which imports the same frozen values. The standalone career
command remains available; dry-run then apply with the same tunnel:

```bash
pnpm source:import-reviewed-career-rating
DATABASE_URL=<tunnel-url> pnpm source:import-reviewed-career-rating -- \
  --actor owner --reason "Owner-reviewed career Rating 3.0 for inactive/special player" \
  --apply --confirm-reviewed-career-rating
```

## Snapshot metrics written on import

| Bundle field | Destination | `period_type` |
| --- | --- | --- |
| `recent.rating` + `recent.maps` | `player_stat_snapshot.metric = rating_3_0` | `LAST_3_MONTHS` |
| `recent.firepower` | `firepower` | `LAST_3_MONTHS` |
| `recent.adr` | `adr` | `LAST_3_MONTHS` |
| `career.rating` | `career_rating` | `CAREER` |
| `majorsWon` | `majors_won` | `CAREER` |
| `mvpCount` | `mvp_count` | `CAREER` |
| `top20Placements[]` | `top20_rank` (one row per year) | `CAREER` |
| `countryCode` | `player.country_code` | identity, not a snapshot |

Public queries select only `provider = HLTV` for the snapshot fields. Other providers cannot occupy
HLTV Rating, Firepower, ADR, honors, or Top 20.

## What not to do

- Do not enable `HLTV_SYNC_ENABLED` to “just get the data.”
- Do not call `/stats/players/` from Node, tests, or CI (Cloudflare 403).
- Do not use gigobyte/HLTV or any third-party HLTV client.
- Do not spoof Cloudflare challenges.
- Do not copy Rating from Liquipedia, BO3, or PandaScore into HLTV fields.
- Do not treat a three-month Rating as career Rating.
- Do not invent Round Swing, career Rating, or ADR from adjacent numbers.
- Do not infer nationality from the current team.
- Do not run capture against production from a public request or GitHub Action.
- Do not recapture or include retired Special players in the reviewed-stats bundle; their data is
  frozen and coverage is non-retired HLTV identities only.
- Do not import the same `capturedAt` twice; capture again so the timestamp is new.

See `docs/DATA_SOURCES.md` for provider boundaries and `docs/RUNBOOK.md` for the trusted CLI list.
