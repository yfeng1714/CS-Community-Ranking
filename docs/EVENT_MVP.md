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
  then **better team standing**, then **more maps played**. Ranks are unique `1…N` (no shared
  competition rank). Nickname is only the last total-order key. This is unlike `/ranking`, which
  still shares rank on equal score (`1, 1, 3`).
- Pairing pool is unchanged. Candidates who are not in the Core/Review pool may exist as Player
  (and Event-only Team) rows **without** `pool_player_entry` / `pool_team_entry`.
- Roster rule: if a player **enters** the current HLTV event Top 10, add them. If a player
  **leaves** Top 10, keep them on the ballot and keep their votes. Import must not delete
  candidates that are missing from a later snapshot.

## HLTV Top 10 source

Official stats URL:

```text
https://www.hltv.org/stats/players?event=8261
```

Event: Esports World Cup 2026, HLTV event id `8261`,
`https://www.hltv.org/events/8261/esports-world-cup-2026`.

Take the first 10 rows of the Rating 3.0 table (Player, Maps, Rating 3.0) and keep any previous
Top 10 players who have dropped, using their **current** HLTV rank / maps / rating. Do **not** use
BO3’s 7.x “group stage ranking” or Liquipedia. Node Playwright often gets Cloudflare 403 on
`/stats/players/`; capture from a browser that already passed the challenge, then save
`data/reviewed-sources/hltv-ewc-2026-candidates.json`. Public pages only read Postgres.

Current snapshot `capturedAt` `2026-08-22T03:10:00.000Z` has 13 ballot rows: HLTV ranks 1–10 plus
kept dropouts `n1ssim` (13), `kyousuke` (15), and `niko` (37). Event-only identities (not in the
pairing pool): `xkacpersky` (Ninjas in Pyjamas), `tenzy` (magic), `xfl0ud` (FUT), `nqz` (MIBR).
`try` is already in the pairing pool. Import may create Event-only Player/Team rows, attach local
portraits/logos, and write a STARTER roster **without** admitting them to pairing. Event-only HLTV identities are not required by `pnpm source:import-reviewed-hltv-stats`;
that import covers pairing-pool players only.

## Team standing (成绩)

Standing is the player's **current team result** in this event, stored on `event_mvp_candidate`,
not on pairing-pool `event_team_result`. Source is the official HLTV prize distribution
(`https://www.hltv.org/events/8261/esports-world-cup-2026#PrizeDistribution`). Do not invent
冠军/亚军/季军/殿军 until that table names 1st–4th.

| Code | UI | HLTV prize row | Tie-break rank |
| --- | --- | --- | --- |
| `CHAMPION` | 冠军 | 1st | 1 |
| `RUNNER_UP` | 亚军 | 2nd | 2 |
| `THIRD` | 季军 | 3rd | 3 |
| `FOURTH` | 殿军 | 4th | 4 |
| `SEMIFINAL` | 四强 | unnamed 1st–4th while still playing | 4 |
| `QUARTERFINAL` | 八强 | 5–8th | 5 |
| `ROUND_OF_16` | 十六强 | 9–16th | 6 |
| `GROUP` | 小组赛 | 17–32nd | 7 |

Missing standing sorts last. 2026-08-22 capture: Spirit / FURIA / FUT / Legacy = 四强; Falcons /
Vitality = 八强; magic = 十六强; NiP / PARIVISION / MIBR = 小组赛.

## Event-only identity

If a candidate has no photo/team/logo in our DB, fill them from official HLTV profile and team
pages using the same local-copy rule as the pool: profile `playerbodyshot` and team-page
`teamlogo` (night-only when HLTV publishes one), converted to WebP under `public/images/`. Do not
hotlink `img-cdn.hltv.org`. Do not recapture retired Specials. Do not add Event-only people to the
pairing pool. Event-only HLTV identities are not required by `pnpm source:import-reviewed-hltv-stats`;
that import covers pairing-pool players only.

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

Web pre-deploy runs `scripts/migrate.ts`, which applies `drizzle/0006_event_mvp_standing.sql`
before import. The page shows “尚未开放” until an import writes the contest and candidates.
`railway run` injects `postgres.railway.internal` and cannot be used from a laptop. Do not reset
production. Do not print tunnel passwords or IPv6. Close the tunnel after.

## Schema

- `event_mvp_contest` — currently one ACTIVE row, slug `ewc-2026`
- `event_mvp_candidate` — current Top 10 plus retained dropouts; `event_rating`, `source_rank`,
  `maps`, `team_standing`
- `event_mvp_vote` — one non-revoked row per visitor per contest per `usage_date`

Vote counts are computed with `COUNT` of `VALID` rows. Do not mix these rows with `vote` /
`ballot`.
