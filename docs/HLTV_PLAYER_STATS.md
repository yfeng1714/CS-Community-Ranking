# HLTV Player Stats — capture and import playbook

This is the operational path for updating public HLTV player data. Future agents should follow it
instead of inventing a live adapter, scraping `/stats/players/`, or filling Rating from Liquipedia
or BO3.

Public requests never fetch HLTV. Keep `HLTV_SYNC_ENABLED=false`. Never run this capture from CI.

## What the site actually displays

Vote cards:

- default: past-3-month **Rating 3.0** + **Firepower** (`N/100`);
- identity line: **Majors won** and **Total MVPs** when captured (`2 Major · 32 MVP`; zeros are
  shown; omit the line only when both values are missing);
- details: **career Rating**, **ADR**, **maps**.

Player pages show the same fields. Missing values render as `—`.

## What HLTV player profiles currently expose

Capture loads `https://www.hltv.org/player/{id}/{slug}` in local Playwright Chromium. Parser
`hltv-player-profile-stats-html-v2` reads:

| Field | Source on `/player/{id}/{slug}` | Stored metric |
| --- | --- | --- |
| Past 3 months Rating 3.0 | `.player-stat` / `.statsVal` | `rating_3_0` / `LAST_3_MONTHS` |
| Past 3 months maps | `(Past 3 months • N maps)` | `maps` on the rating snapshot |
| Firepower | `.player-stat` Firepower `N` | `firepower` / `LAST_3_MONTHS` |
| Majors won | `.highlighted-stat` **Majors won**, else `.majorWinner` (`N x Major winner`) | `majors_won` / `CAREER` |
| Total MVPs | `.highlighted-stat` **Total MVPs** when present, else the visible `.mvp-count` trophy badge | `mvp_count` / `CAREER` |

Do **not** treat these as the same thing:

- **Majors played** is not Majors won.
- **Major MVPs** and EVPs are not Total MVPs.
- The profile all-time block is matches / KDR / headshots, **not** career Rating 3.0.
- ADR is not in `playerpage-container` on the live profile. Direct `/stats/players/` URLs remain
  Cloudflare-blocked from Node.

If a field is not on the page, leave it `null`. Never infer career Rating from recent Rating, ADR
from KDR, or honors from a different label.

The reviewed JSON still stores `recentSourceUrl` as the official dated `/stats/players/{id}/{slug}`
URL so identity/period validation stays exact. The HTML that actually loaded is the player profile.

## Local commands

Identity coverage comes from `data/canonical/2026-beta.json` (currently 70 HLTV player IDs). The
output JSON is Git-ignored:

`data/reviewed-sources/hltv-player-stats-local.json`

### 1. Capture

```bash
pnpm source:capture-reviewed-hltv-stats -- \
  --start YYYY-MM-DD --end YYYY-MM-DD \
  --output data/reviewed-sources/hltv-player-stats-local.json
```

Defaults: period end = today, period start = three months earlier, delay = 8s, one retry 20s after
HTTP 403/429/503, stop after three consecutive denials.

- `--resume` fills identities that still lack recent metrics. It cannot upgrade a v1 Rating/maps-only
  file; that schema is rejected. Use `--force` for a full recapture after a parser/schema bump.
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
maps, Majors, MVPs, and honest `—` for career/ADR.

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
writes observed snapshots plus one Admin audit. Missing career/ADR stay missing.

### 5. Apply to Railway (production)

The JSON stays on the operator laptop. `railway run` injects production `DATABASE_URL`:

```bash
railway run --service web -- pnpm source:import-reviewed-hltv-stats -- \
  --file data/reviewed-sources/hltv-player-stats-local.json \
  --actor owner --reason "Reviewed official HLTV player profile stats" \
  --apply --confirm-reviewed-stats
```

Do not commit the JSON, `.env`, or captured HTML. Code/docs may be committed; stats land only in
PostgreSQL.

## Snapshot metrics written on import

| Bundle field | Snapshot `metric` | `period_type` |
| --- | --- | --- |
| `recent.rating` + `recent.maps` | `rating_3_0` | `LAST_3_MONTHS` |
| `recent.firepower` | `firepower` | `LAST_3_MONTHS` |
| `recent.adr` | `adr` | `LAST_3_MONTHS` |
| `career.rating` | `career_rating` | `CAREER` |
| `majorsWon` | `majors_won` | `CAREER` |
| `mvpCount` | `mvp_count` | `CAREER` |

Public queries select only `provider = HLTV` for these fields. Other providers cannot occupy HLTV
Rating, Firepower, ADR, or honors.

## What not to do

- Do not enable `HLTV_SYNC_ENABLED` to “just get the data.”
- Do not call `/stats/players/` from Node, tests, or CI (Cloudflare 403).
- Do not use gigobyte/HLTV or any third-party HLTV client.
- Do not spoof Cloudflare challenges.
- Do not copy Rating from Liquipedia, BO3, or PandaScore into HLTV fields.
- Do not treat a three-month Rating as career Rating.
- Do not run capture against production from a public request or GitHub Action.
- Do not import the same `capturedAt` twice; capture again so the timestamp is new.

See `docs/DATA_SOURCES.md` for provider boundaries and `docs/RUNBOOK.md` for the trusted CLI list.
