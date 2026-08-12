# Public UI — Milestone 5

## Scope

Milestone 5 is the first complete anonymous public journey. It provides:

- `/` — random Vote pair, expandable details, Skip, result, and explicit Next;
- `/ranking` — active-Edition competition ranking and client-side search;
- `/player/{slug}` — public player identity, roster, score record, and approved stats;
- `/about` — short product, scoring, random-pairing, and Candidate Pool explanation;
- `/privacy` — anonymous identity, quota/risk, retention, external-data, and contact disclosures.

The top navigation contains Vote, Ranking, and About. Player pages are reached through player links;
Privacy is linked from the footer and About page. `CS 野榜` is a working identity pending the final
name/domain/visual decision.

## Vote interaction

Before resolution, each complete Player card is a choice target. Keyboard shortcuts are `1` for the
left player, `2` for the right player, and `S` for Skip. Details remain separately expandable and
show recent three-month Rating/maps, career Rating, deliberate placeholders for unsupported fields,
and an honest freshness label.

After resolution, the same two cards remain in place and show the user's selection plus both current
rank/score records. The result panel reports whether the action counted, current counted H2H
percentages, counted decisions/Skips, and a small-sample warning below 30 decisions. Zero-decision
percentages are displayed as unavailable rather than `0%`. There is no timer and no automatic Next.

`THROTTLED` and `SUSPICIOUS` actions are stored but honestly presented as non-counting. A user who
has exhausted the 50-Ballot daily full-weight quota may continue voting and seeing results.

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
presented as zero.

The latest approved HLTV recent `rating_3_0 / LAST_3_MONTHS` and `career_rating / CAREER` snapshots
are used and labeled as HLTV Rating. Other providers' metrics remain isolated and cannot silently
fill those fields. Stats are `MISSING` when absent, `CURRENT` through 48 hours after capture, and
`STALE` after 48 hours. This threshold is an M5 presentation default and may be made
provider-specific in M7.

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
responses. No M5 route mutates Pool membership or imports external data.

See `docs/API.md` for endpoint/cache behavior and `docs/RUNBOOK.md` for the manual/browser smoke
checks.
