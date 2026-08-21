# HLTV profile portraits — capture and import playbook

This is the operational path for uniform player portraits. Future agents should follow it instead of
reusing the old HLTV **ranking-page 200×200** crop, hotlinking `img-cdn.hltv.org`, inventing a live
adapter, or mixing ranking-page heads with profile body shots.

Public requests never fetch HLTV. Keep `HLTV_SYNC_ENABLED=false`. Never run this capture from CI.

## Why this method

Vote, Ranking, and Player frames are square with `object-fit: cover` and
`object-position: center top`. The first Core 70 pass exported the small grey ranking-page portraits.
Review Manual + advent later used the official **player-profile body shot**. On 2026-08-19 the Core
70 files were replaced with that same crop so the whole pool matches.

Do **not** go back to ranking-page `/ranking/teams/` accordion images. Those are a different
transform (native 200×200). The profile body shot is the `img.player-summary-stat-box-left-bodyshot`
on `https://www.hltv.org/player/{id}/{slug}` (often ~400×417). HLTV stores the real URL on
`data-cookieblock-src` (and sometimes `data-src`); `src` may be empty until consent/lazy-load.

MachineWJQ stays `OWNER_PROVIDED`. Do not recapture retired Specials unless the Owner explicitly
asks. advent already has a profile body shot from the Review Manual pass.

## What capture actually does

`pnpm assets:capture-hltv-profile-portraits` launches local Playwright Chromium (desktop Chrome UA,
1440×900, `--no-proxy-server`). For each target it:

1. Loads the exact `hltvProfileUrl` from the canonical / Review Manual / Special retired manifest.
2. Waits for `.player-summary-stat-box-left-bodyshot` or `.playerNickname`.
3. Reads `img.player-summary-stat-box-left-bodyshot` `src` / `data-cookieblock-src` / `data-src`.
4. Asserts `alt`/`title` contain the configured nickname.
5. Asserts the URL is `https://img-cdn.hltv.org/playerbodyshot/...`.
6. Fetches that URL **inside the page** (not from Node), converts PNG/JPEG to real WebP with sharp
   (`quality: 82`, `effort: 6`, `.rotate()`), and writes `{slug}.webp`.
7. Records ignored evidence JSON with profile URL, source URL, SHA-256, and source enum.

Default delay is **8s** between players. One retry after access denial (new page, 20s wait). Stop
after **three consecutive** denials so a Cloudflare block cannot become dozens of failed requests.
`--resume` fills only missing slugs in an existing ignored JSON. `--player-slug` captures one player.
`--headed` shows the browser. `--delay-ms 0` is only for a single-player retry, not a full sweep.

Rate-limit: do not hammer HLTV. Do not enable live HLTV sync. Do not run this on the public web path.

## Source filters and default files

`--source` is `CORE`, `REVIEW_MANUAL`, or `SPECIAL_RETIRED`. Omit it only when you intentionally want
the union (Core 70 + Review Manual 20 + advent). `listHltvProfilePortraitTargets` skips
`machinewjq`. With `exactOptionalPropertyTypes`, scripts must **omit** `source` when unset; do not
pass `source: undefined`.

| `--source` | Players | Ignored evidence JSON | Ignored image directory |
| --- | --- | --- | --- |
| `CORE` | 70 canonical starters | `data/reviewed-sources/hltv-profile-portraits-core-local.json` | `data/reviewed-sources/hltv-profile-portraits-core/` |
| `REVIEW_MANUAL` (default when omitted for the 21-player pass) | 20 Review Manual + advent | `data/reviewed-sources/hltv-profile-portraits-local.json` | `data/reviewed-sources/hltv-profile-portraits/` |
| `SPECIAL_RETIRED` | advent only (MachineWJQ excluded) | same default JSON/dir as Review Manual unless `--output` is set | same |

Those JSON/directories are gitignored. Never commit them. Preserve them with the Owner’s private
operational evidence. `assets/attribution.json` is also gitignored; `assets/registry.json` is
tracked and stores only `assetPath` + permission.

Identity join is exact: HLTV external ID, profile slug, nickname, profile URL, and
`{slug}.webp`. Import rejects a checksum mismatch and rejects files that are not real WebP bytes
(`RIFF....WEBP`). Production sends `X-Content-Type-Options: nosniff`.

## Local commands — replace Core 70 in place (uniformity pass)

This is the pass that made Core match Review Manual. Paths stay `/images/players/{slug}.webp`, so
**production Postgres `photoPath` does not need a rewrite**.

```bash
corepack pnpm assets:capture-hltv-profile-portraits -- --source CORE
corepack pnpm assets:import-hltv-profile-portraits -- --source CORE
# dry-run first; then:
corepack pnpm assets:import-hltv-profile-portraits -- --source CORE \
  --apply --confirm-profile-portraits
corepack pnpm assets:check
```

Import with `--apply` copies WebP into `public/images/players/`, updates registry/attribution
**in place** (do not reshuffle `assets/registry.json` order), and only rewrites a manifest
`photoPath` when it actually changed. For Core, those paths already matched, so
`data/canonical/2026-beta.json` stays untouched.

Commit the `public/images/players/*.webp` bytes. Do not commit ignored capture JSON, the capture
directories, or `assets/attribution.json`.

## Local commands — Review Manual 20 + advent (first-time attach)

```bash
corepack pnpm assets:capture-hltv-profile-portraits
corepack pnpm assets:import-hltv-profile-portraits \
  --apply --confirm-profile-portraits
```

That writes new `photoPath` values into the Review Manual / Special retired manifests. Production
rows then need `pnpm players:apply-photos` over a Railway Postgres tunnel (`--actor owner --apply
--confirm-player-photos`). That script currently applies Review Manual + Special retired manifests
only, not Core.

## Production notes

- If you only replaced bytes at existing `photoPath` values (the Core uniformity pass), push the
  images and skip `players:apply-photos`.
- If you attached a **new** path, apply it through the audited player update after a **fresh** SSH
  tunnel into the web replica. `railway run` injects `postgres.railway.internal` and cannot be used
  from a laptop. Do not print tunnel passwords or IPv6. Close the tunnel after. Do not reset
  production.
- After a web deploy, reopen a fresh tunnel if you still need DB writes.
- `pnpm build` typechecks these scripts. `pnpm test:unit` does not.

## Visual contract

- Served path: `/images/players/{slug}.webp` (keep exact case; `MachineWJQ.webp` is Owner-provided).
- Square UI crops from the top. Do not force-downsample a sharp Owner photo to 200×200.
- Vote-card portraits are 7.5rem after the body-shot pass.
- Public CSP is `img-src 'self' data:`. Never hotlink HLTV on Vote, Ranking, Player, or About.

## Checks

```bash
corepack pnpm assets:check
corepack pnpm typecheck
corepack pnpm test:unit
```

Spot-check a Core player (for example `karrigan.webp`) is taller than 200×200, a Review Manual
player matches the same crop style, and MachineWJQ is unchanged.
