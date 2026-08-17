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

## Before public launch

- Final public product name, domain, slogan, and visual identity. M5 deliberately uses `CS 野榜` as
  a working identity rather than treating it as final branding.

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
- Complete Player-stat capture remains optional post-launch presentation work. The August 15 direct Player-stats
  probe also returned HTTP 403, and browser inspection showed that the current page structure has
  drifted from the saved parser fixture. A checksum-locked, exact-identity reviewed import now exists,
  plus a no-overwrite template generator. One isolated 70-identity rehearsal imported only one
  observed recent metric and left every unavailable value null. No partial stats bundle was imported
  into Railway, so the public UI honestly shows missing values for all 70 Players.

Resolved on 2026-08-14: the working launch label is `2026 Beta Edition`. The Owner later removed the
personal email and dedicated privacy/contact page for the small community beta; reconsider both when
the project gains a custom domain or materially broader usage.

## After ADR 0005 is triggered

- Choose the owner-controlled domain, test Cloudflare proxy-on versus DNS-only from Mainland China,
  and decide whether the direct Railway origin remains public or is restricted against WAF bypass.

When a question changes frozen product meaning or a major technical decision, document the answer in
an ADR and update the Implementation Plan or Product Decision Chronicle as appropriate.
