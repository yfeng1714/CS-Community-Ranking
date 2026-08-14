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

- Final Candidate Pool, Manual Review teams, Special players, and completed-2026 T1 whitelist.
- Image acquisition remains an M10 work item, but external rights clearance no longer blocks the
  small community beta. Exact sources are recorded; Owner-accepted pending-rights assets remain
  visible warnings until the Owner clears or replaces them.
- Final eligible-Ballot quota after closed-beta data.
- Final execution evidence for the approved ADR 0006 in-place reset: verified backup/restore/R2
  copy, exact target, cutover window, and explicit destructive-action approval. No second Railway DB
  is planned, and the fictional `2026` records must not be relabeled as production.
- Low-frequency HLTV sync window. The identifying User-Agent points to the deployed project URL, but
  the bounded August 10 rehearsal request received HTTP 403. The reviewed, checksum-locked top-12
  fallback proves the manual audited path without pretending automated retrieval succeeded. Retry a
  fresh low-frequency live sync near cutover and require new Owner-reviewed fallback evidence if it
  remains blocked. The start date, HLTV-over-VRS roster policy, exact identities, and 14-Team union
  are resolved; all 14 current Pool proposals and Edition activation remain separate approvals.

Resolved on 2026-08-14: the working launch label is `2026 Beta Edition`. The Owner later removed the
personal email and dedicated privacy/contact page for the small community beta; reconsider both when
the project gains a custom domain or materially broader usage.

## After ADR 0005 is triggered

- Choose the owner-controlled domain, test Cloudflare proxy-on versus DNS-only from Mainland China,
  and decide whether the direct Railway origin remains public or is restricted against WAF bypass.

When a question changes frozen product meaning or a major technical decision, document the answer in
an ADR and update the Implementation Plan or Product Decision Chronicle as appropriate.
