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
- Ranking display: community votes descending, then official HLTV **event Rating 3.0** descending,
  then **more maps played**. Ranks are unique `1…10` (no shared competition rank). Nickname is only
  the last total-order key if votes, rating, and maps all match. This is unlike `/ranking`, which
  still shares rank on equal score (`1, 1, 3`).
- Pairing pool is unchanged. Candidates who are not in the Core/Review pool may exist as Player
  (and Event-only Team) rows **without** `pool_player_entry` / `pool_team_entry`.

## HLTV Top 10 source

Official stats URL:

```text
https://www.hltv.org/stats/players?event=8261
```

Event: Esports World Cup 2026, HLTV event id `8261`,
`https://www.hltv.org/events/8261/esports-world-cup-2026`.

Take the first 10 rows of the Rating 3.0 table (Player, Maps, Rating 3.0). Do **not** use BO3’s
7.x “group stage ranking” or Liquipedia. Node Playwright often gets Cloudflare 403 on
`/stats/players/`; capture from a browser that already passed the challenge, then save
`data/reviewed-sources/hltv-ewc-2026-top10.json`. Public pages only read Postgres.

Current snapshot `capturedAt` `2026-08-21T01:10:00.000Z`. Two Top 10 players were not in the
pairing pool: `xkacpersky` (Ninjas in Pyjamas) and `tenzy` (magic). Import may create those Player
and Team rows, attach local portraits/logos, and write a STARTER roster **without** admitting them
to pairing. Ranks 11–15 from the earlier Top 15 snapshot are dropped on re-import (candidate rows
only; leftover Event-only Player rows such as `dziugss` / `nqz` stay unused).

## Event-only identity

If a candidate has no photo/team/logo in our DB, fill them from official HLTV profile and team
pages using the same local-copy rule as the pool: profile `playerbodyshot` and team-page
`teamlogo`, converted to WebP under `public/images/`. Do not hotlink `img-cdn.hltv.org`. Do not
recapture retired Specials. Do not add Event-only people to the pairing pool.

## Automatic HLTV event sync — investigated, not implemented

There is **no** live plan to scrape this event hourly on Railway.

- Committed Railway crons are expire-ballots, integrity, retention, snapshot, KPI, and Valve VRS.
  There is no `railway/job-sync-hltv.json`. `pnpm job:sync-hltv` exists as a **manual** trusted
  command and stays behind `HLTV_SYNC_ENABLED=false`. RUNBOOK still says HLTV cadence is unapproved.
- That job only covers team ranking plus recent/career Player stats. It does **not** parse
  `/stats/players?event=8261`.
- Direct Node and often Playwright get Cloudflare 403 on the event stats table. Public requests
  must never fetch HLTV. An hourly Railway cron would hammer HLTV and fail closed, then page
  visitors would still see the last imported snapshot.
- Honest refresh path remains: local capture of the official table → reviewed JSON →
  `pnpm source:import-event-mvp` through a laptop SSH tunnel. If EWC is still running, recapture
  after meaningful match days (or once daily at most). After `endsAt` (`2026-08-23`), freeze the
  snapshot. Do not add a cron until Cloudflare access, a dedicated event parser, and a
  low-frequency schedule are explicitly approved.

## Local import (production needs a fresh SSH tunnel)

```bash
corepack pnpm source:import-event-mvp
corepack pnpm source:import-event-mvp -- --actor owner --apply --confirm-event-mvp
```

Web pre-deploy runs `scripts/migrate.ts`, which creates empty Event MVP tables. The page shows
“尚未开放” until this import writes the contest and 10 candidates. `railway run` injects
`postgres.railway.internal` and cannot be used from a laptop. Do not reset production. Do not
print tunnel passwords or IPv6. Close the tunnel after.

## Schema

- `event_mvp_contest` — currently one ACTIVE row, slug `ewc-2026`
- `event_mvp_candidate` — 10 players, `event_rating`, `source_rank`, maps
- `event_mvp_vote` — one non-revoked row per visitor per contest per `usage_date`

Vote counts are computed with `COUNT` of `VALID` rows. Do not mix these rows with `vote` /
`ballot`.
