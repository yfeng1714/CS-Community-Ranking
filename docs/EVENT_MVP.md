# Event MVP — current event (EWC)

This is a **separate Season Mode**. It does not change the annual community board (`+1/−1`,
random pairs, Ballot fishing controls). Owner unfroze a limited Event MVP after the main loop
shipped, because the original freeze was about short-window **true-random pairs** and `+1/−1`
stability. This mode uses a public list and a daily `+1` instead.

Public requests never fetch HLTV. Keep `HLTV_SYNC_ENABLED=false`.

## Product rules

- Path: `/current-event`. Nav bubble between 榜单 and 关于: **当期赛事 - EWC**.
- Scoring: one visitor may give **+1 to one player per Asia/Shanghai calendar day**. No loser
  penalty. Tomorrow is a new vote; votes accumulate.
- Anti-cheat reuse: anonymous Visitor cookie, mutation origin guard, per-visitor rate limit, IP
  risk key, observe/enforce risk codes. A second vote the same day is rejected (`EVENT_MVP_ALREADY_VOTED`),
  not a 150-Ballot throttle. `SUSPICIOUS` visitors/risk codes store a row that does not count.
- Ranking display: community votes descending; tied votes use official HLTV **event Rating 3.0**
  descending, then nickname. Shared rank follows vote count only (`1, 1, 3`).
- Pairing pool is unchanged. Candidates who are not in the Core/Review pool may exist as Player
  rows **without** `pool_player_entry`.

## HLTV Top 15 source

Official stats URL:

```text
https://www.hltv.org/stats/players?event=8261
```

Event: Esports World Cup 2026, HLTV event id `8261`,
`https://www.hltv.org/events/8261/esports-world-cup-2026`.

Take the first 15 rows of the Rating 3.0 table (Player, Maps, Rating 3.0). Do **not** use BO3’s
7.x “group stage ranking” or Liquipedia. Node Playwright often gets Cloudflare 403 on
`/stats/players/`; capture from a browser that already passed the challenge, then save
`data/reviewed-sources/hltv-ewc-2026-top15.json`. Public pages only read Postgres.

Current snapshot `capturedAt` `2026-08-21T01:10:00.000Z`. Four players were not in the pairing
pool at capture time: `xkacpersky`, `tenzy`, `dziugss`, `nqz`. Import may create those Player
rows and HLTV identities without admitting them to pairing.

## Local import (production needs a fresh SSH tunnel)

```bash
corepack pnpm source:import-event-mvp
corepack pnpm source:import-event-mvp -- --actor owner --apply --confirm-event-mvp
```

Web pre-deploy runs `scripts/migrate.ts`, which creates empty Event MVP tables. The page shows
“尚未开放” until this import writes the contest and 15 candidates. `railway run` injects
`postgres.railway.internal` and cannot be used from a laptop. Do not reset production. Do not
print tunnel passwords or IPv6. Close the tunnel after.

## Schema

- `event_mvp_contest` — currently one ACTIVE row, slug `ewc-2026`
- `event_mvp_candidate` — 15 players, `event_rating`, `source_rank`, maps
- `event_mvp_vote` — one non-revoked row per visitor per contest per `usage_date`

Vote counts are computed with `COUNT` of `VALID` rows. Do not mix these rows with `vote` /
`ballot`.
