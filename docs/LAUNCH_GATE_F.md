# Milestone 10 Launch Gate F

This is the auditable go/no-go record for Candidate Pool V1, closed beta, and V0.1 launch. A checked
repository item is not evidence for an unchecked real-world item. Record dates, Edition code,
deployment IDs, report files, measured values, and the Owner decision before changing a production
Edition from `DRAFT` to `ACTIVE`.

## Current boundary

- [x] Owner authorized M10 repository preparation on 2026-08-14.
- [x] The read-only `launch:check` command and regression coverage exist.
- [x] The one-database, in-place production reset strategy was approved on 2026-08-14 (ADR 0006).
- [x] The final backup/restore/R2 evidence has been recorded and the reset was performed on
      2026-08-15.
- [x] The real Core-only 2026 Candidate Pool data was imported and approved on 2026-08-15.
- [x] Real Edition `2026` was activated on 2026-08-15 after a blocking-free launch report.
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

The Railway environment named `production` was converted from fictional M9 staging to the real
Core-only beta on 2026-08-15. The fictional rows were not renamed or reused. ADR 0006's one-time
reset exception is now consumed: all future database work must preserve real history through forward
migrations and the approved backup policy.

## Production cutover evidence — 2026-08-15

- Exact target: workspace `yfeng's Projects`, project `observant-empathy`
  (`d3599e57-0191-4265-9cd2-04c9978ac665`), environment `production`
  (`30a211bc-4e19-4067-8a38-a1485f6e0f0b`), database service `Postgres`
  (`fbdf66a0-9727-4064-9802-4f0dd3659beb`), database `railway`.
- Final fictional-staging dump:
  `backups/final-fictional-staging-2026-08-15T1037CST.dump`, 146,259 bytes, SHA-256
  `cf3efa880c4c666076571bb5371dd5a773e51c390b32ed080da1d9b58dd44d16`. Its 486-byte
  manifest has SHA-256 `60c1fb5bc50e225f63042dd243f541d653157bf897ed76dc57d4ab033e3c44c8`.
  The Railway-side and local dump checksums matched; a PostgreSQL 18 scratch restore succeeded and
  all 14 critical-table counts matched. The Owner confirmed both final artifacts were uploaded to
  private R2 bucket `cs-community-ranking-backups`.
- Web and all six cron deployments were stopped and all six cron schedules were temporarily cleared
  before reset. `public` and the stale `drizzle` journal schema were removed; committed migrations
  then recreated 29 public tables and four migration-journal rows. The surviving journal was caught
  by post-reset verification before any canonical data was inserted.
- Active Admin `owner` was recreated as ID 1 by copying only its password hash from the verified
  backup. The password itself was not read or printed. Canonical manifest SHA-256
  `c9eadfa1d609f5d5dd96df050b0841afc73be06b05fc70f6d5cb36f967c010f7` created one DRAFT
  Edition, 14 Teams, 70 Players, 70 starter memberships, and 239 bootstrap audits.
- Reviewed HLTV snapshot ID 1 covers the August 10 exact top 12; official Valve VRS snapshot ID 2
  covers 396 Teams from August 3. Both were explicitly approved by `owner`. The production draft
  generated proposal IDs 1–14 with no conflicts, no removals, and the same ten documented warnings;
  all 14 were approved through the guarded review service.
- The pre-activation report returned `blocking: false`, 14 Core Teams, 70 pairing-enabled Players,
  2,415 pairs, healthy integrity, fresh sources, and two warnings: provisional asset rights and 70
  missing optional stat snapshots. The audited transition then moved Edition ID 1 from DRAFT to
  ACTIVE with the same gate rerun inside the activation command.
- A password printed by an earlier tunnel helper was treated as exposed. The PostgreSQL role and
  Railway `PGPASSWORD` were rotated, `Postgres.DATABASE_URL` was converted to a same-service
  reference, and Web plus all six jobs now use `${{Postgres.DATABASE_URL}}` rather than copied
  credentials. New authentication and Web reference resolution were verified without printing the
  secret.
- Read-only production smoke passed HTTPS liveness/readiness, `/`, `/ranking`, the 70-Player ranking
  API, and all six required security headers. It deliberately created no test Ballot or Vote.
- The dedicated post-activation integrity job reported `healthy: true`, zero Votes, zero score sum,
  and no violations. Running the pre-activation gate after activation correctly returns only its
  designed `EDITION_REQUIRES_DRAFT_REVIEW` blocker while every substantive check still passes.
- Web deployment `20341852-01ad-4568-940c-ef1fdff7db6f` and cron deployments
  `08c3604c-dd2a-43b8-9dfa-6d6e1614b3b1`, `3b7b40da-22e7-4e4a-a066-f9e4f4aadecc`,
  `967c0a6b-ce09-468a-9d60-95dc4036bdf2`, `408d254f-5e29-4898-b01a-db925be2fe93`,
  `c2c038ba-b2a9-41ac-ac51-5b4a8aac0be9`, and `1b831cdf-25c5-46f2-9fe8-4a3c87d24693`
  reached `SUCCESS`. All six exact UTC schedules and future next-run timestamps were verified.

## 1. Production environment decision

- [x] Owner chose the lowest-cost, one-database in-place reset; no second Railway DB is planned.
- [x] Record the final backup, restore verification, R2 copy, exact reset target, and explicit
      destructive-action approval before resetting the application schema.
- [x] Confirm Singapore placement, private DB networking, exact Railway hostname, variables,
      spending controls, alert recipients, and `RISK_ENFORCEMENT_MODE=observe`.
- [x] Apply committed migrations only; verify that the product tables start empty.
- [x] Create the production Admin through a trusted operator path; never expose web registration.
- [x] Create the real DRAFT Edition through the audited canonical bootstrap. Activation remained a
      separate action.
- [ ] Establish the daily logical-backup cadence and private R2 second-copy procedure before the
      first meaningful beta Vote.

Why a clean state was required: Edition code is unique, the M9 `2026` Edition was ACTIVE, and its
rows could not be disguised as production history. Because all pre-cutover rows were documented
fictional fixtures and there were no real users, the owner approved resetting the existing
PostgreSQL service rather than paying for a second one. The verified final dump/R2 copy preserves
that staging evidence.

The completed lowest-cost sequence used a separate clean local PostgreSQL database for the initial
canonical-data/source/conflict rehearsal, with Docker running only for the work window. It used no
fictional seed. Railway was reset only after the Pool was close to Owner approval, then repeated the
sync/draft/readiness flow with fresh-enough sources. The local report remained preparation rather
than production evidence.

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
- [x] Enter canonical Teams, Players, verified HLTV profile URLs, aliases/identities, and exactly
      five current formal starters per eligible Core Team. The completed-2026 T1 whitelist is
      intentionally deferred for the Core-only launch.
- [x] Verify every admitted Team and Player has an unambiguous HLTV identity.
- [x] Run a fresh official Valve VRS sync and import the checksum-locked reviewed HLTV ranking.
- [x] Owner reviews and approves both immutable source snapshots with source URL, published time,
      parser version, record count, and checksum.
- [x] Run `pnpm job:build-pool-draft -- --edition 2026`.
- [x] Resolve missing/ambiguous identities, stale inputs, roster disagreement, and all pending
      proposals. Re-run the draft after a newer source or canonical-data correction.
- [x] Record possible removals but never apply them automatically. The final draft had none.

## 3. Owner Candidate Pool approval

Record the final counts and the reason/evidence for every non-Core entry. Admission category never
changes pairing probability or score.

| Category        | Teams | Players | Owner-reviewed evidence | Approved by/date   |
| --------------- | ----: | ------: | ----------------------- | ------------------ |
| Core            |    14 |      70 | Approved HLTV/VRS rank  | owner / 2026-08-15 |
| Review Auto     |     0 |       0 | Deferred for beta       | owner / 2026-08-15 |
| Review Manual   |     4 |      20 | Owner-reviewed 2026-08-17 HLTV team pages; public reasons in `data/review-manual/2026-08-17.json` | owner / 2026-08-17 |
| Special players |   n/a |       2 | Owner-approved retired Specials 2026-08-18: MachineWJQ, advent | owner / 2026-08-18 |

Initial-beta scope decision on 2026-08-15: launch Core-only with the rehearsed 14 Teams and 70
current starters. Review Auto, the 2026 T1 whitelist, and Special admissions remain deferred. On
2026-08-17 the Owner admitted four Review Manual Teams (BC.Game, 100 Thieves, TYLOO, Lynn Vision)
and their 20 current starters through the trusted CLI because Admin Team/Player create returned
“Operation is temporarily unavailable” even after Postgres committed the test `tyloo` /
`machinewjq` rows (mutate commits first; the form used to treat a later refresh as failure). Core 14
is unchanged. Total enabled Players after that
admission: **90**. Total possible pairs `n(n-1)/2`: **4,005**. New-player HLTV stats and images are
an honest later pass. On 2026-08-18 the Owner admitted two retired Specials (MachineWJQ, advent)
for pairing tests. Total enabled Players: **92**. Total possible pairs: **4,186**. Retired Special
data is frozen and excluded from HLTV recapture.

- [x] Every pairing-enabled Team-derived Player is still a current formal starter for its source
      Team.
- [x] No former starter is present in the initial clean Pool; later changes must preserve history and
      pairing-disable former starters.
- [x] Every current Pool admission has immutable `pool_change_log` and general Admin audit evidence.
- [x] Total enabled Players: **70**. Total possible pairs `n(n-1)/2`: **2,415**.
- [x] 2026-08-17 Review Manual expansion: **90** enabled Players, **4,005** possible pairs. Core 14
      and existing ranking/vote history were not reset.
- [x] 2026-08-18 retired Special expansion: **92** enabled Players, **4,186** possible pairs
      (MachineWJQ, advent). Retired identities are excluded from HLTV recapture.

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

- [x] `blocking: false`; two warnings individually reviewed and recorded.
- [x] Zero Player scores/wins/losses/skips before activation.
- [ ] Vote correctness suite passes against production-like staging data.
- [ ] Migration/build/release commit is frozen and recorded: **TBD**.
- [x] Owner authorized exactly one audited `DRAFT` → `ACTIVE` transition on 2026-08-15.

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
