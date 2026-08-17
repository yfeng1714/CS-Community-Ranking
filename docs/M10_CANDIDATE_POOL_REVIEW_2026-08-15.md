# M10 Candidate Pool Review — 2026-08-15

This packet separates deterministic repository/local-database evidence from decisions that still
belong to the Owner. It is not production approval, Edition activation, or permission to reset the
Railway database.

## Rehearsed Core set

The approved canonical manifest and the preserved local rehearsal resolve the union of the official
August 3 Valve VRS top 12 and reviewed August 10 HLTV top 12 to these 14 Teams:

- Falcons, Vitality, Spirit, FURIA, Natus Vincere, 9z, BetBoom, Aurora, G2, MOUZ, Legacy, FaZe,
  Astralis, and PARIVISION.
- Each Team has exactly five current HLTV-authoritative starters in the manifest: 70 Players total.
- The preserved rehearsal generated and explicitly approved 14 `CORE` proposals through the normal
  Gate D review service. It has 70 enabled Players, zeroed rankings, healthy integrity, and 2,415
  possible unordered pairs.
- Ten nonblocking warnings remain review evidence: six unmatched Valve ranks 13–20 and four Valve
  roster disagreements. The latter use HLTV's roster without hiding the disagreement, per the
  Owner's August 14 decision.

This proves the local workflow. It does not make the preserved source snapshots fresh enough for a
later production cutover and does not authorize copying the rehearsal database into Railway.

## Review Auto evidence checked

`REVIEW_AUTO` requires both a top-20 ranking and a qualifying same-year result: confirmed T1 Top 4
or Major Top 8. Rank 13–20 alone is insufficient.

The completed [IEM Cologne Major 2026 result](https://www.hltv.org/results?event=8301) provides this
objective Top 8; the [HLTV Major hub](https://www.hltv.org/major) records Falcons as winner and
FURIA as runner-up:

| Placement | Team                      |
| --------- | ------------------------- |
| 1         | Falcons                   |
| 2         | FURIA                     |
| 3–4       | Spirit, Aurora            |
| 5–8       | G2, 9z, BetBoom, Vitality |

All eight are already in the rehearsed Core set. Entering and Owner-confirming this Event would
therefore preserve useful evidence but add no `REVIEW_AUTO` Team today. The August 12–23 EWC event
was still in progress on the [HLTV events calendar](https://www.hltv.org/events) during this review
and was not used as completed-result evidence.

The reviewed HLTV importer now accepts either an exact top 12 or exact top 20, labels the two
coverage levels separately, and rejects date/URL, identity, roster, duplicate, and coverage drift.
Reliable ordinary-page extraction of exact August 10 ranks 13–20 was not obtained: the normal page
loads, but automated DOM access resets/timeouts and direct provider requests return 403. No access
control was bypassed and no third-party scraping service was used. Consequently, the current
top-12 fallback is not represented as top-20 evidence and the complete Review Auto evaluation
remains open.

## Player stats evidence checked

Player stats are optional presentation data and do not affect Pool eligibility, pairing, or score.
The reviewed fallback now generates an exact 70-identity template whose absent values are explicit
`null`, then validates exact IDs, slugs, periods, official URLs, checksum, and Admin confirmation.

The disposable stats rehearsal imported one browser-observed recent metric (karrigan: 46 maps,
Rating 3.0 value 0.73) and left the other 69 recent snapshots plus every career snapshot missing.
It passed atomically without inventing data. This file remains ignored local operational evidence;
it is not a complete production stats capture.

## Clean-room rehearsal on August 15

A second empty local database independently passed migrations, active-Admin creation, the approved
canonical bootstrap, reviewed HLTV top-12 import/approval, and the 70-identity reviewed-stats import.
Two attempts to retrieve the official Valve file (the application adapter and direct `curl`) timed
out with zero bytes even though the separate web lookup could reach the public file. The failed
adapter run was recorded and stored no partial source snapshot. The clean-room draft therefore
stopped at its required missing VRS input; the earlier complete rehearsal remains the end-to-end
VRS/Pool proof.

## Owner scope decision and follow-ups

- **Resolved for the initial beta on 2026-08-15:** the Owner chose a Core-only launch. Review Auto,
  Review Manual, the completed-2026 T1 Event whitelist, and Special Players are deliberately
  deferred rather than treated as missing launch blockers. The launch Pool is the rehearsed
  14-Team/70-Player Core set.
- Exact official ranks 13–20 and the Cologne Major evidence remain preserved future inputs. When the
  Owner reopens Review Auto, checksum-lock permitted top-20 evidence, decide the T1 whitelist, and
  rerun the ordinary source → draft → proposal-review workflow.
- Any later Review Manual Team or Special Player still requires an explicit public reason and
  audited Admin action. None is inferred or pre-approved here.
- On 2026-08-17 the Owner admitted BC.Game, 100 Thieves, TYLOO, and Lynn Vision as Review Manual
  through `pnpm pool:admit-review-manual` (Admin Team/Player create was unavailable). Review Auto
  and Special Players remain deferred.
- Production execution completed on 2026-08-15: refreshed/approved sources, regenerated the draft,
  reviewed exact proposal IDs 1–14, and passed `launch:check` while the real Edition was DRAFT.
- ADR 0006 backup/restore/R2/reset approval and the later Edition activation remained separate Gate
  F decisions; both execution records are in `docs/LAUNCH_GATE_F.md`.
