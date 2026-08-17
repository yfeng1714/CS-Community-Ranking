# Public UI — Milestone 5

## Scope

Milestone 5 is the first complete anonymous public journey. It provides:

- `/` — random Vote pair, expandable details, Skip, result, and explicit Next;
- `/ranking` — active-Edition competition ranking and client-side search;
- `/player/{slug}` — public player identity, roster, score record, and approved stats;
- `/about` — short product, scoring, random-pairing, and Candidate Pool explanation.

The top navigation contains Vote, Ranking, and About. Player pages are reached through player links;
the About call-to-action links back to Vote and Ranking. The small community beta has no dedicated
privacy/contact route; the Owner will reconsider one when the project has a custom domain or
materially broader use. `CS 野榜` is a working identity pending the final name/domain/visual decision.

## Vote interaction

Before resolution, each complete Player card is a choice target. Keyboard shortcuts are `1` for the
left player, `2` for the right player, and `S` for Skip. The default card shows recent three-month
HLTV Rating and Firepower (`N/100`). Majors won and Total MVPs sit under the identity line when
captured (`2 Major · 32 MVP`; zeros are shown; the line is omitted only when both values are
missing). Nationality is the stored ISO-2 `country` code, or `国籍待补`. Details expand highest
HLTV Top 20 (peak rank plus every year at that rank) and maps, plus an honest freshness label.
Unsupported or unexposed fields remain `—`; KAST, Round Swing, career Rating, and ADR are not shown.

After resolution, the same two cards remain in place and show the user's selection plus both current
rank/score records. A counted Left/Right vote uses the heading `这一票已计入社区榜`. Skip uses
`已跳过` (both players still record a Skip appearance; scores do not change). `SUSPICIOUS` votes
can still be presented as non-counting (`选择已记录，但本次不计榜`). The panel also shows current
counted H2H percentages, counted decisions/Skips, and a small-sample warning below 30 decisions.
Zero-decision percentages are displayed as unavailable rather than `0%`. There is no timer and no
automatic Next.

The public Vote page does not show remaining daily quota, post-quota warnings, or a distinct
"did not count" state for `THROTTLED` votes. Daily full-weight quota remains backend-only: issuance
still marks Ballots `THROTTLED` after the Edition limit, and those Votes still do not change ranking.
`SUSPICIOUS` votes can still be presented as non-counting. A visitor who has exhausted the 150-Ballot
daily full-weight quota may continue voting; the UI stays the same.

Vote headlines are `二选一投票箱` before resolution and `社区投票结果` afterward. Player portraits
are sized to the local 200×200 sources: about 112px on Vote cards, 200px on Player pages, and the
existing 2.6rem Ranking avatar. They are not stretched as full-bleed posters.

## Manual reload contract

ADR 0003 remains authoritative. The browser checks `PerformanceNavigationTiming.type`; only a true
`reload` navigation may trigger automatic advance. The workflow is:

1. call `POST /api/v1/ballots/next`;
2. only when that response says `reusedOpenBallot: true`, resolve its ID with `SKIP`;
3. call `/next` again and render the replacement directly, without a result interstitial.

Ordinary first loads, React Strict Mode rerenders, retries, and repeated `/next` calls preserve the
open Ballot. A session-storage marker makes the reload workflow recoverable: if the Skip succeeded
but the replacement response was lost, the next load accepts the replacement without skipping it;
if the Skip response was lost, the same-choice resolve retry is idempotent.

## Ranking and Player display

Ranking uses score descending and competition ranks (`1, 1, 3`). Equal-score display order is
counted decisions descending, then nickname ascending; this ordering never changes the shared rank.
Desktop exposes the complete record. Mobile prioritizes rank, player, and score; the Player page
contains the expanded record.

Search is local to the loaded ranking and matches nickname, team name/short name, and country. Player
pages display missing values as `—` or an explicit explanatory phrase; a missing value is never
presented as zero. When a Player has an approved `hltv_profile_url`, the profile includes an
explicit new-tab HLTV reference link; absent links leave no empty control and no third-party request
is made while rendering the page.

Vote cards, Ranking rows, and Player profiles render a locally served Team logo when `teamLogoUrl`
is configured. The neutral charcoal container keeps both dark and light marks legible in either
theme. A missing path removes only the mark and keeps the Team text, so older databases and
unconfigured Teams degrade without a broken-image state.

The latest HLTV snapshots for `rating_3_0` / `LAST_3_MONTHS`, `firepower` / `LAST_3_MONTHS`,
`adr` / `LAST_3_MONTHS`, `career_rating` / `CAREER`, `majors_won` / `CAREER`, `mvp_count` /
`CAREER`, and `top20_rank` / `CAREER` are used. Rating fields are labeled as HLTV Rating. Other
providers' metrics remain isolated and cannot silently fill those fields. Stats are `MISSING` when
absent, `CURRENT` through the configured freshness window, and `STALE` afterward.
`EXTERNAL_STATS_STALE_AFTER_HOURS` defaults to 48 hours. Provider failure keeps stale data visible
and never breaks the Vote page. Career Rating, ADR, and Round Swing stay off the public UI because
official player profiles do not expose them; do not invent them. Highest Top 20 is aggregated from
the latest `top20_rank` year rows (peak rank, every year at that rank). Nationality is
`player.country_code`.

## Theme, responsive behavior, and accessibility

First visit is always light mode, independent of operating-system preference. The explicit theme
button switches to dark mode and stores only the selected theme in local storage. It does not affect
visitor identity or voting.

The interface has visible focus styles, semantic headings/tables/buttons, a skip-to-content link,
ARIA live/focus handling for results, keyboard shortcuts, meaningful image fallbacks, reduced-motion
support, responsive desktop/mobile layouts, and explicit loading, empty, error, missing, and stale
states. Player images use local/approved paths when available and otherwise render a neutral
monogram—no live third-party image request occurs.

The root `<body>` suppresses direct hydration-attribute warnings because browser extensions may add
spell/grammar-check attributes before React loads. Suppression is limited to that element; it does
not conceal mismatches inside the application tree.

## Public query boundary

`src/domain/public/queries.ts` is the shared read projection for pages and M5 JSON endpoints. Public
counters are checked before conversion from `bigint`; unexpected read errors map to detail-free
responses. `teamLogoUrl` is the public local path only; asset source, rights status, and review notes
remain outside the projection. No M5 route mutates Pool membership or imports external data.

See `docs/API.md` for endpoint/cache behavior and `docs/RUNBOOK.md` for the manual/browser smoke
checks.
