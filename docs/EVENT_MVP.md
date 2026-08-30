# Event MVP — current and archived events

This is a **separate Season Mode**. It does not change the annual community board (`+1/−1`,
random pairs, Ballot fishing controls). Owner unfroze a limited Event MVP after the main loop
shipped, because the original freeze was about short-window **true-random pairs** and `+1/−1`
stability. This mode uses a public list and a daily `+1` instead.

Public requests never fetch HLTV. Keep `HLTV_SYNC_ENABLED=false`.

## Product rules

- Current event path: `/current-event`. Nav bubble: **当期赛事 - BLAST S2**.
- Archive path: `/past-events` (nav **往期赛事**, between 当期赛事 and 关于). The list is clickable
  like Ranking players; `/past-events/{slug}` shows the same detailed table. EWC (`ewc-2026`) is
  archived there. The current slug redirects to `/current-event`.
- Only one contest row may be `ACTIVE`. Importing the current bundle freezes every other active
  contest. Archived bundles import as `FROZEN` and must not steal the live slot.
- Voting stays open through the second `Asia/Shanghai` calendar day after the event's recorded
  `endsAt`. For BLAST Open Porto (`endsAt` `2026-09-06`), the final voting date is `2026-09-08`;
  new votes close at `2026-09-09 00:00` Shanghai time. EWC (`endsAt` `2026-08-23`) already closed
  after `2026-08-25`. The page keeps the final table visible after closure but disables vote
  buttons. The API independently enforces the same boundary on the **ACTIVE** contest only.
- Scoring: one visitor may give **+1 to one player per Asia/Shanghai calendar day** on the current
  contest. No loser penalty. Tomorrow is a new vote; votes accumulate. Archived contests keep their
  vote totals and reject new votes.
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

## Current event: BLAST Open Porto 2026 (BLAST OPEN S2)

Official stats URL:

```text
https://www.hltv.org/stats/players?event=8249
```

Event: BLAST Open Porto 2026, HLTV event id `8249`,
`https://www.hltv.org/events/8249/blast-open-porto-2026`.
Reviewed file: `data/reviewed-sources/hltv-blast-open-s2-2026-candidates.json`.
Slug: `blast-open-s2-2026`. Dates: `2026-08-26` – `2026-09-06`.

Take the first 10 rows of the Rating 3.0 table (Player, Maps, Rating 3.0) and keep any previous
Top 10 players who have dropped, using their **current** HLTV rank / maps / rating. Do **not** use
BO3 or Liquipedia. Node Playwright often gets Cloudflare 403 on `/stats/players/`; capture from a
browser that already passed the challenge. Public pages only read Postgres.

Current snapshot `capturedAt` `2026-08-30T04:13:00.000Z` has 10 ballot rows (HLTV ranks 1–10,
group stage, no dropouts yet). Event-only identities: `jl` (Vitality stand-in for mezii) and
`cptkurtka023` (Inner Circle). Import may create Event-only Player/Team rows, attach local
portraits/logos, and write a STARTER roster **without** admitting them to pairing.

## Archived event: Esports World Cup 2026

Official stats URL:

```text
https://www.hltv.org/stats/players?event=8261
```

Reviewed file: `data/reviewed-sources/hltv-ewc-2026-candidates.json`. Slug: `ewc-2026`.
Nav label in archive: **EWC 2026**. Final post-final snapshot `capturedAt` `2026-08-24T00:17:00.000Z`
has 15 ballot rows: HLTV ranks 1–10 plus kept dropouts `kscerato` (11), `kyousuke` (12), `xfl0ud`
(28), `niko` (34), and `n1ssim` (35). Event-only identities: `xkacpersky`, `tenzy`, `xfl0ud`, `nqz`.
Re-importing this file must leave the contest `FROZEN`.

## Recapture checklist (stats **and** 成绩)

Every Event MVP sync must update **both** surfaces in the same reviewed JSON. Import already writes
`event_rating`, `maps`, `source_rank`, **and** `team_standing`; a snapshot that only refreshes Rating
will leave stale 成绩 on the page.

1. Recapture the Rating 3.0 table for that event id: current Top 10 plus every previous ballot
   player who dropped, with live rank / maps / rating. Add new Top 10 identities; do not delete
   dropouts.
2. Recapture the official HLTV prize distribution (`#PrizeDistribution`) and rewrite `teamStanding`
   for **every** ballot team. When 1st–4th rows name teams, promote `SEMIFINAL` to `CHAMPION` /
   `RUNNER_UP` / `THIRD` / `FOURTH`. Do not leave 四强 after the table names winners. Do not use
   Liquipedia or BO3.
3. Dry-run then apply `pnpm source:import-event-mvp` through a fresh laptop SSH tunnel. Default file
   is the current BLAST bundle. Pass `--file data/reviewed-sources/hltv-ewc-2026-candidates.json`
   only when refreshing the archive.

## Team standing (成绩)

Standing is the player's **current team result** in this event, stored on `event_mvp_candidate`,
not on pairing-pool `event_team_result`. Source is the official HLTV prize distribution. Do not
invent 冠军/亚军/季军/殿军 until that table names 1st–4th.

| Code           | UI     | HLTV prize row                      | Tie-break rank |
| -------------- | ------ | ----------------------------------- | -------------- |
| `CHAMPION`     | 冠军   | 1st                                 | 1              |
| `RUNNER_UP`    | 亚军   | 2nd                                 | 2              |
| `THIRD`        | 季军   | 3rd                                 | 3              |
| `FOURTH`       | 殿军   | 4th                                 | 4              |
| `SEMIFINAL`    | 四强   | unnamed 1st–4th while still playing | 4              |
| `QUARTERFINAL` | 八强   | 5–8th                               | 5              |
| `ROUND_OF_16`  | 十六强 | 9–16th                              | 6              |
| `GROUP`        | 小组赛 | 13–16th / still in groups           | 7              |

Missing standing sorts last. BLAST 2026-08-30 prize table named only 13–16th (Lynn Vision, 9z,
paiN, DENDELE); 1st–12th unnamed. Starry = 小组赛; other BLAST Top 10 teams still playing = 小组赛.
EWC 2026-08-24 after Spirit beat FUT 3–1: Spirit = 冠军; FUT = 亚军; Legacy = 季军; FURIA = 殿军.
The 成绩 column shows a trophy next to 冠军.

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
  `/stats/players?event=8249` or `?event=8261`.
- Direct Node and often Playwright get Cloudflare 403 on the event stats table. Public requests
  must never fetch HLTV. An hourly Railway cron would hammer HLTV and fail closed, then page
  visitors would still see the last imported snapshot.
- Honest refresh path remains: local capture of the official **stats table and prize 成绩** →
  reviewed JSON → `pnpm source:import-event-mvp` through a laptop SSH tunnel. Recapture both in the
  same snapshot. If BLAST is still running, recapture after meaningful match days (or once daily at
  most). After `endsAt`, freeze the stored contest after the grace window for operational clarity;
  voting already fails closed based on the date even if the row still says `ACTIVE`. Do not add a
  cron until Cloudflare access, a dedicated event parser, and a low-frequency schedule are
  explicitly approved.

## Local import (production needs a fresh SSH tunnel)

```bash
corepack pnpm source:import-event-mvp
corepack pnpm source:import-event-mvp -- --actor owner --apply --confirm-event-mvp
corepack pnpm source:import-event-mvp -- --file data/reviewed-sources/hltv-ewc-2026-candidates.json
corepack pnpm source:import-event-mvp -- --file data/reviewed-sources/hltv-ewc-2026-candidates.json \
  --actor owner --apply --confirm-event-mvp
```

The default file is the current BLAST bundle and becomes `ACTIVE` (freezing any other live
contest). The EWC file stays `FROZEN`. `railway run` injects `postgres.railway.internal` and cannot
be used from a laptop. Do not reset production. Do not print tunnel passwords or IPv6. Close the
tunnel after.

## Schema

- `event_mvp_contest` — at most one `ACTIVE` row (currently `blast-open-s2-2026`); archived rows
  are `FROZEN` (currently `ewc-2026`)
- `event_mvp_candidate` — current Top 10 plus retained dropouts; `event_rating`, `source_rank`,
  `maps`, `team_standing`
- `event_mvp_vote` — one non-revoked row per visitor per contest per `usage_date`

Vote counts are computed with `COUNT` of `VALID` rows. Do not mix these rows with `vote` /
`ballot`.
