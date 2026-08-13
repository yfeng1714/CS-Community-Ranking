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
- Whether the late-2026 launch is labeled a normal Edition or explicitly a beta Edition.

## Before Milestone 10

- Final Candidate Pool, Manual Review teams, Special players, and completed-2026 T1 whitelist.
- Image rights/licensing, attribution, and public privacy/takedown contact.
- Final eligible-Ballot quota after closed-beta data.

## After ADR 0005 is triggered

- Choose the owner-controlled domain, test Cloudflare proxy-on versus DNS-only from Mainland China,
  and decide whether the direct Railway origin remains public or is restricted against WAF bypass.

When a question changes frozen product meaning or a major technical decision, document the answer in
an ADR and update the Implementation Plan or Product Decision Chronicle as appropriate.
