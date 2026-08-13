# ADR 0005: Defer Cloudflare and a custom domain

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owner:** Project Owner

## Context

The new product has no usage baseline. The owner selected the lowest-cost launch posture and the
Railway-generated HTTPS address rather than buying a domain only to complete a Cloudflare test.
Cloudflare cannot proxy a `*.up.railway.app` hostname as the owner's zone because that parent domain
belongs to Railway.

The Product Decision Chronicle already defines Cloudflare as optional and removable. Ranking
correctness, Vote eligibility, CSRF protection, Admin authorization, and durable daily quota were
therefore implemented inside the application and PostgreSQL rather than at the edge.

## Decision

Use the Railway-generated HTTPS hostname directly for staging and the initial small closed beta.
Do not buy a custom domain or enable Cloudflare solely for Milestone 9.

- Keep `APP_ORIGIN` equal to the exact Railway HTTPS origin.
- Keep `CLIENT_IP_MODE=railway`, use only Railway's trusted client-IP header path, and retain
  `RISK_ENFORCEMENT_MODE=observe` through initial closed beta.
- Treat the custom-domain and Cloudflare proxy/DNS-only Gate E rows as owner-approved deferrals, not
  failed application requirements.
- Continue direct-route smoke, load, security-header, logging, and Mainland China network checks.
- Do not add Turnstile, a mandatory challenge, Redis, or a second rate-limiting service for an attack
  that has not occurred.

Reconsider a custom domain and Cloudflare when any of these occurs:

- the product needs a stable public brand/domain;
- automated traffic materially increases Railway CPU, memory, egress, errors, or cost;
- the configured spend alert or sustained infrastructure-rate-limit events indicate abuse;
- a real application-layer availability incident occurs;
- traffic growth justifies multiple Web replicas or distributed edge controls; or
- measured Mainland China routing shows a proxy experiment is worthwhile.

If Cloudflare is later adopted for security, the owner must separately decide whether the direct
Railway hostname remains public. A publicly reachable origin can bypass edge WAF/rate-limit rules;
keeping it as a fallback and hiding it for stronger origin protection are competing goals that
cannot be claimed simultaneously.

## Alternatives considered

- **Buy a domain and enable Cloudflare now:** adds edge DDoS/WAF/rate-limit options, but introduces a
  recurring asset and another operational layer before demand is known.
- **Redesign application security around Cloudflare:** rejected because it would make a third party
  and potentially unreliable Mainland China path part of ranking correctness.
- **Remove existing application controls because Railway is public:** rejected; edge protection and
  application correctness solve different problems.

## Consequences

- No application or database redesign is required. The existing `railway` and `cloudflare` proxy
  modes preserve a later configuration-only onboarding path.
- Direct Railway retains Railway's network-layer protections but does not add an application-layer
  WAF or edge bot/rate-limit shield. A sufficiently large Layer-7 attack can affect availability or
  usage cost before in-process limits respond.
- The process-local limiter is suitable for the current single replica but resets on deploy and is
  not a distributed DDoS control. PostgreSQL quota and Vote invariants remain authoritative.
- Cloudflare A/B is no longer a Gate E blocker under the current owner decision. Direct-route
  evidence and the remaining security/operational checks still are.

## Validation

- Direct Railway smoke and bounded load tests pass with `CLIENT_IP_MODE=railway`.
- Mutation Origin/Fetch-Metadata checks, cookie attributes, security headers, risk observation,
  daily quota, and score integrity remain verified without Cloudflare.
- Railway metrics, request summaries, job alerts, spend controls, and KPI reports are reviewed during
  closed beta; any trigger above reopens this ADR.
