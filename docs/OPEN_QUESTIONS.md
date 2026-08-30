# Open Questions

No unresolved owner decision blocks Milestone 0.

## Milestone 9 accepted follow-ups

- China Mobile 4G/Wi-Fi reachability and a measured Wi-Fi window are confirmed. China Telecom/Unicom
  testers are unavailable and a separately classified China Mobile evening-peak window remains a
  follow-up when practical; these are missing observations, not observed route failures.
- A failed-deployment email drill was owner-waived because creating it safely would require a
  temporary code/config failure against the sole active staging service. The separate failed-job
  email path is proven. The $10 usage-email delivery will be observed naturally rather than forced.

Railway Hobby/billing, spend thresholds, failed-job email delivery, and the direct generated HTTPS
route are resolved. The private R2 disaster copy is also complete, and Gate E was approved on
2026-08-14. ADR 0005 defers a custom domain and Cloudflare edge proxy until a measured trigger; they
are not missing M9 inputs.

## Later branding follow-up

- The Owner confirmed `CS 野榜` and `2026 Beta Edition` are sufficient for the current
  small-community launch scope on 2026-08-22. A later custom domain, slogan, and broader visual
  identity remain deliberately reviewable rather than blocking this beta.

## Milestone 10 inputs and approvals

- The initial beta Candidate Pool launched Core-only: 14 Teams and their 70 current starters. On
  2026-08-17 the Owner explicitly admitted four Review Manual Teams (BC.Game, 100 Thieves, TYLOO,
  Lynn Vision) with public reasons. On 2026-08-18 the Owner admitted two retired Specials
  (MachineWJQ, advent) for closed-beta pairing tests. Review Auto and the completed-2026 T1
  whitelist remain deferred and are not Gate F blockers. Retired Special data does not change and
  is excluded from future HLTV recapture.
- Image acquisition is complete for the current canonical 14 Teams/70 Players. External rights
  clearance no longer blocks the small community beta; exact sources are recorded, and
  Owner-accepted pending-rights assets remain visible warnings until cleared or replaced.
- Daily full-weight Ballot quota is now 150; further closed-beta tuning remains possible.
- The ADR 0006 one-time reset is resolved and consumed. Final dump/restore/private-R2 evidence, exact
  target, clean migrations, source approval, 14 proposal approvals, activation, credential rotation,
  and production smoke are recorded in `docs/LAUNCH_GATE_F.md`.
- Automated HLTV retrieval remains deliberately disabled after bounded requests returned HTTP 403.
  The active Core Pool uses the reviewed, checksum-locked August 10 top-12 fallback without
  overstating it as top-20 Review Auto evidence. Revisit a permitted low-frequency adapter only when
  Review Auto or a later refresh needs it; do not bypass provider controls.
- Player-stat capture is now complete for all 90 non-retired pairing Players: the reviewed profile
  bundle supplies recent Rating 3.0, Firepower, nationality, Major/MVP totals, and available HLTV
  Top 20 history, and was applied to Railway on 2026-08-17. MachineWJQ has a separately reviewed
  career Rating; retired Specials remain outside automatic recapture. Direct `/stats/players/`
  automation is still disabled because of HTTP 403, so future refreshes use the bounded local
  browser-capture and reviewed-import workflow.
- The EWC Event MVP beta closed after the two-day Shanghai-calendar grace
  period (`endsAt` 2026-08-23, last vote date 2026-08-25). It is archived at `/past-events`.
  BLAST Open Porto 2026 (`endsAt` 2026-09-06) is the live contest and accepts votes through
  2026-09-08 Shanghai time.
- The current production dump/restore drill, private R2 copy, and Railway-hosted daily cadence are
  complete. The dedicated backup job no longer depends on the Owner's Mac; monthly restore drills
  and the local fallback remain operator procedures.

Resolved on 2026-08-14: the working launch label is `2026 Beta Edition`. The Owner later removed the
personal email and dedicated privacy/contact page for the small community beta; reconsider both when
the project gains a custom domain or materially broader usage.

## After ADR 0005 is triggered

- Choose the owner-controlled domain, test Cloudflare proxy-on versus DNS-only from Mainland China,
  and decide whether the direct Railway origin remains public or is restricted against WAF bypass.

When a question changes frozen product meaning or a major technical decision, document the answer in
an ADR and update the Implementation Plan or Product Decision Chronicle as appropriate.

## Presence and daily visitors (investigated 2026-08-24, not implemented)

The Owner asked whether the site can show **current online users** and **daily total users**. First-party
data already exists, but it does not support an honest public counter without new product work.

What we already store:

- `anonymous_visitor.last_seen_at` updates when `VisitorIdentityService.find` runs (Ballot
  issue/resolve and `/api/v1/events` when a visitor cookie already exists).
- `product_event` records `PAGE_VIEW` / `RANKING_VIEW` / etc. Attributed rows have `visitor_id`;
  a page view **without** a cookie is stored with `visitor_id` null and **does not mint** identity
  (`docs/API.md`). Raw events are purged after 90 days.
- Daily KPI `ballot.visitors` is the count of visitors who received a Ballot that Shanghai date
  (`visitor_daily_usage`), not all people who opened the site.

Why that is not “online now” or “daily users”:

- Identity is created on the first Ballot mutation, not on a read-only visit. Ranking/About lurkers
  never get a cookie, so they never appear in `last_seen_at` or attributed events.
- There is no heartbeat. A cookied visitor who leaves a Vote pair open stops generating events;
  `last_seen_at` is only as fresh as the last find/page-view. Counting `last_seen_at` in the last
  five minutes would miss idle tabs and most first-time readers.
- Distinct `product_event.visitor_id` for today undercounts lurkers and overcounts nothing useful
  from null-visitor rows (those are page loads, not people).
- Third-party analytics, raw IPs, or Cloudflare-only counts would conflict with Mainland-first
  first-party metrics and the anonymous-cookie model.

If implemented later, the honest path is still first-party and cookie-based:

1. **Daily unique visitors:** mint (or reuse) the visitor cookie on the first public mutation *or*
   a dedicated presence POST, then `COUNT(DISTINCT visitor_id)` for `Asia/Shanghai` midnight–midnight.
   KPI Ballot visitors can stay as a separate “people who voted today” number.
2. **Online now:** a low-frequency heartbeat (about 30–60s, keepalive/beacon) that only updates
   `last_seen_at` for an existing visitor, then count rows with `last_seen_at` newer than a short
   window (for example five minutes). Do not create a new identity from the heartbeat if the product
   still wants lurkers uncookied; in that case the public number must be labeled as cookied/active
   visitors, not “everyone on the page.”
3. Keep this off the ranking path, rate-limit it with the existing public limiter, and never put IPs
   or vote choices in the counter. Display is a later Owner decision; V0.1 does not show it.
