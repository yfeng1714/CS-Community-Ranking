# Milestone 10 Launch Gate F

This is the auditable go/no-go record for Candidate Pool V1, closed beta, and V0.1 launch. A checked
repository item is not evidence for an unchecked real-world item. Record dates, Edition code,
deployment IDs, report files, measured values, and the Owner decision before changing a production
Edition from `DRAFT` to `ACTIVE`.

## Current boundary

- [x] Owner authorized M10 repository preparation on 2026-08-14.
- [x] The read-only `launch:check` command and regression coverage exist.
- [x] The one-database, in-place production reset strategy was approved on 2026-08-14 (ADR 0006).
- [ ] The final backup/restore/R2 evidence has been recorded and the reset has been performed.
- [ ] Real 2026 Candidate Pool data has been imported and approved.
- [ ] A real Edition has been activated.
- [ ] Closed beta has started.
- [ ] Gate F has Owner sign-off.

Local rehearsal evidence as of 2026-08-14 (not production sign-off):

- [x] Applied the approved canonical manifest to isolated DB `csr_m10_rehearsal_20260814`; it created
      one DRAFT Edition, 14 Teams, 70 Players, 70 current roster memberships, 84 identities, and 239
      audit rows with an empty Pool.
- [x] Synchronized and approved the live official August 3 Valve snapshot locally (396 Teams,
      checksum `9989f6e14c2ef288a4e9e0be6e709e664106aa129a1c901218d0ef9a2afbfb7e`).
- [x] Recorded the initial bounded August 10 HLTV fetch, Owner-requested retry, and post-network-
      restart retry as three failed HTTP 403 runs with no partial snapshot, then imported the
      reviewed official top-12 fallback through the guarded audited path (checksum
      `eb20d2d97ec3c693ce97c4ebccc1dfa2e598d3e445993152c3692a932a8a1e3d`). Ordinary Owner-browser
      access works; that does not make the server-side adapter request successful.
- [x] Generated and Owner-approved 14 conflict-free Core Team proposals through Gate D. The prior
      draft remains as 14 `SUPERSEDED` rows; the current 14 are `APPROVED`. Ten warnings preserve six
      non-eligible VRS rank-13–20 identity observations and four VRS roster disagreements resolved
      under HLTV authority.
- [x] Verified 14 Core Teams, 70 pairing-enabled current starters, 70 zeroed rankings, five starters
      per Team, 2,415 possible pairs, complete Pool/Admin audit coverage, and healthy integrity.
- [x] The pre-asset local `launch:check` reports `blocking: false`; its only warnings were 84
      neutral-placeholder paths (14 Teams + 70 Players) and 70 missing optional HLTV stat snapshots.
      The later repository asset passes configured all 14 Team logos and all 70 Player portraits, but
      they have not been retroactively applied to this preserved rehearsal DB.
- [x] Kept `csr_m10_rehearsal_20260814` DRAFT and zeroed. Activated only a separate local clone,
      `csr_m10_ui_preview_20260814`, for public-UI inspection so preview activity cannot pollute the
      canonical rehearsal.

Additional independent evidence on 2026-08-15 (still not production sign-off):

- [x] A generated exact 70-identity reviewed-stats bundle passed dry run and atomic application in
      isolated DB `csr_m10_stats_rehearsal_20260815`. It stored only the one browser-observed recent
      karrigan metric (46 maps, Rating 3.0 value 0.73); 69 recent and all 70 career metrics remained
      explicitly missing. The resulting launch report remained nonblocking.
- [x] Empty DB `csr_m10_gatef_20260815` independently passed migrations, local Admin creation,
      canonical bootstrap, reviewed HLTV top-12 import/approval, and the exact-identity reviewed
      stats import. The official Valve fetch and one direct download retry both timed out with zero
      bytes, so no VRS snapshot or partial draft was inserted and the clean-room rehearsal stopped
      at the required input boundary. The preserved August 14 rehearsal remains the full VRS →
      Pool-approval proof.
- [x] The reviewed HLTV importer now supports separately labeled exact top-12 and exact top-20
      inputs. Exact permitted August 10 ranks 13–20 were not obtained, so the current source remains
      accurately labeled Core-only coverage. The completed IEM Cologne Major Top 8 was verified;
      all eight Teams are already Core. See `docs/M10_CANDIDATE_POOL_REVIEW_2026-08-15.md`.
- [x] Admin now reports source/draft/proposal state and one exact next action in a read-only Pool
      update workflow card. It does not replace source approval, draft execution, proposal review,
      or Owner decisions.

The current Railway environment is named `production`, but its database contains the explicitly
fictional M9 staging Edition `2026`, test players, SKIPs, and audit history. It remains staging. Do
not rename those records into production data or bootstrap the reset database with
`db:seed`/`db:seed:staging`. ADR 0006 permits one documented pre-launch reset only after the final
verified backup and explicit reset approval; that exception expires as soon as meaningful real data
exists.

## 1. Production environment decision

- [x] Owner chose the lowest-cost, one-database in-place reset; no second Railway DB is planned.
- [ ] Record the final backup, restore verification, R2 copy, exact reset target, and explicit
      destructive-action approval before resetting the application schema.
- [ ] Confirm Singapore placement, private DB networking, exact Railway hostname, variables,
      spending controls, alert recipients, and `RISK_ENFORCEMENT_MODE=observe`.
- [ ] Apply committed migrations only; verify that the product tables start empty.
- [ ] Create the production Admin through `admin:create`; never expose web registration.
- [ ] Create the real DRAFT Edition through audited Admin mutation. Do not activate it yet.
- [ ] Establish the daily logical-backup cadence and private R2 second-copy procedure before the
      first meaningful beta Vote.

Why a clean state: Edition code is unique, the M9 `2026` Edition is already ACTIVE, and its rows must
not be disguised as production history. Because all current rows are documented fictional fixtures
and there are no real users, the owner approved resetting the existing PostgreSQL service rather
than paying for a second one. The verified final dump/R2 copy preserves the staging evidence.

Lowest-cost sequence: do the initial canonical-data/source/conflict rehearsal in a separate clean
local PostgreSQL database, with Docker running only for the work window. This has no Railway cost
and must not use the fictional seed. Perform the Railway reset only when the proposed Pool is close
to Owner approval, then repeat the sync/draft/readiness flow there with still-fresh sources. The
local report is preparation, not production evidence.

The approved low-cost sequence keeps the existing Railway Web, six cron services, generated domain,
and PostgreSQL service. Pause Web/crons, take and independently verify the final staging recovery
point, reset only the confirmed application schema, apply migrations, verify empty product tables,
then recreate the Admin and real DRAFT Edition. Complete fresh source/draft/readiness/smoke checks
before resuming services. This creates deliberate pre-user downtime but no parallel Railway
database cost. See ADR 0006.

## 2. Canonical real-data preparation

- [x] Owner selected the working label `2026 Beta Edition` on 2026-08-14. The final public product
      brand remains separately reviewable.
- [x] The Owner approved `data/canonical/2026-beta.json` on 2026-08-14 for empty-database bootstrap:
      14 Teams, 70 Players, direct HLTV identities/links, and five observed starters per Team. Its
      SHA-256 is printed by `pnpm canonical:bootstrap`. This is not Pool admission or Edition
      activation; see the human summary and four known conflict groups in
      `docs/CANONICAL_DATA_REVIEW_2026-08-14.md`.
- [x] Owner decided on 2026-08-14 that HLTV is authoritative for the current roster whenever an
      approved VRS snapshot disagrees; the disagreement remains review evidence and is not hidden.
- [ ] Enter canonical Teams, Players, optional verified HLTV profile URLs, aliases/identities,
      exactly five current formal starters per
      eligible Team, completed-2026 T1 whitelist, and relevant event results.
- [ ] Verify every admitted Team and Player has an unambiguous HLTV identity.
- [ ] Run fresh official Valve VRS and deliberate low-frequency HLTV ranking syncs.
- [ ] Owner reviews and approves both immutable source snapshots with source URL, published time,
      parser version, record count, and checksum.
- [ ] Run `pnpm job:build-pool-draft -- --edition 2026`.
- [ ] Resolve missing/ambiguous identities, stale inputs, roster disagreement, and all pending
      proposals. Re-run the draft after a newer source or canonical-data correction.
- [ ] Record possible removals but never apply them automatically.

## 3. Owner Candidate Pool approval

Record the final counts and the reason/evidence for every non-Core entry. Admission category never
changes pairing probability or score.

| Category        | Teams | Players | Owner-reviewed evidence | Approved by/date |
| --------------- | ----: | ------: | ----------------------- | ---------------- |
| Core            |       |         | Latest qualifying rank  |                  |
| Review Auto     |       |         | Rank/event rule result  |                  |
| Review Manual   |       |         | Public manual reason    |                  |
| Special players |   n/a |         | Public special reason   |                  |

- [ ] Every pairing-enabled Team-derived Player is still a current formal starter for its source
      Team.
- [ ] Former starters are preserved historically and explicitly pairing-disabled when applicable.
- [ ] Every current Pool admission has immutable `pool_change_log` and general Admin audit evidence.
- [ ] Total enabled Players: **TBD**. Total possible pairs `n(n-1)/2`: **TBD**.

## 4. Assets and early-community policy

- [x] Every configured Team logo and Player portrait is local, appears in tracked
      `assets/registry.json`, and has an ignored local `assets/attribution.json` record with its exact
      source and honest rights status.
- [x] Complete 70-Player portrait set imported through exact ID/slug/Team/nickname verification;
      representative crops from all 14 Teams reviewed locally.
- [x] `pnpm assets:check` passes. `OWNER_ACCEPTED_PENDING_RIGHTS` assets are permitted for the small
      community beta but remain explicit launch warnings for later Owner follow-up.
- [x] The Owner deferred a public privacy/contact route and removed the personal email on 2026-08-14.
      Reconsider the route when a custom domain or materially broader use makes it useful.
- [ ] Working/final product name and beta label are reviewed for the selected launch scope.

Missing optional imagery, pending-rights assets, or HLTV stats may remain honest UI warnings;
unattributed configured assets and unresolved identities may not be silently signed off.
Detailed asset-source/rightsholder records are Dev/Ops-only metadata and must not be exposed by the
public site, public API, or Admin UI. A public GitHub repository would still expose tracked files to
repository readers, which is a separate decision.

## 5. Pre-activation evidence

Run against the rebuilt existing Railway database while the real Edition is still `DRAFT`:

```bash
pnpm launch:check -- --edition 2026
pnpm assets:check
pnpm test:unit
pnpm test:integration
pnpm build
```

`launch:check` exits nonzero when a blocker exists and outputs machine-readable JSON. Preserve the
final report with the deployment/release evidence. It checks fresh approved HLTV/VRS inputs, the
latest conflict-free Pool draft using those exact inputs, pending proposals, eligibility and roster
provenance, zero ranking baseline, identities, integrity, observe-mode risk, asset attribution, and
Pool audit coverage. Placeholder images or missing optional stats are explicit warnings.
The Admin `DRAFT` → `ACTIVE` action re-runs the same checks and refuses activation on any blocker;
the operational rows and Owner sign-off below remain human approvals that code cannot infer.

- [ ] `blocking: false`; warnings individually reviewed and recorded.
- [ ] Zero Player scores/wins/losses/skips before activation.
- [ ] Vote correctness suite passes against production-like staging data.
- [ ] Migration/build/release commit is frozen and recorded: **TBD**.
- [ ] Owner authorizes exactly one audited `DRAFT` → `ACTIVE` transition: **TBD**.

## 6. Closed-beta window

- [ ] Invite only the Owner-approved small tester set; record no personal identities in repository
      evidence.
- [ ] Test desktop/mobile and at least two browser/device families.
- [ ] Record China Mobile; record Telecom/Unicom when testers are available as observations, not
      invented passes/failures.
- [ ] Direct Railway route remains the M10 launch route under ADR 0005. Cloudflare A/B is required
      only if a custom domain/edge layer enters scope before sign-off.
- [ ] Keep risk in observe mode and review false positives for shared NAT/campus/office networks.
- [ ] Capture KPI, `/next`/`/resolve` errors and latency, skip rate, repeat visitors, DB connections,
      Web/DB CPU and memory, and Railway/R2 usage/spend alerts.
- [ ] Tune daily full-weight quota or infrastructure rate limits only from measured evidence; record
      old value, new value, reason, and Owner approval.
- [ ] Run integrity after the window and prove the retained daily backup plus private second copy.

## 7. Launch sign-off

- [ ] No unresolved correctness, security, data, identity, roster, licensing, route, backup, or
      operational blocker remains.
- [ ] Direct Railway Mainland China decision is documented; Cloudflare status is explicit.
- [ ] Rollback/freeze/restore contacts and procedures were reviewed.
- [ ] Final smoke, integrity, logs, alerts, and Admin access pass on the frozen release.
- [ ] Owner approves Gate F and public V0.1 launch.

**Owner:** TBD

**Decision/date:** TBD

**Edition/deployment/commit:** TBD
**Accepted warnings/follow-ups:** TBD
