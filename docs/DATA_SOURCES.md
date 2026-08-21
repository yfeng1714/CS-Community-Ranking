# External Data Sources

Milestone 7 implements provider access only through scheduled CLI jobs. No provider is called from a
public request, tests and CI use saved fixtures only, and provider failure leaves the last stored
snapshot and all voting pages available.

## Provider boundaries

- Valve VRS accepts only HTTPS files in Valve's official
  `ValveSoftware/counter-strike_regional_standings` repository and parses its dated global Markdown
  table.
- HLTV is disabled by default. When deliberately enabled, it uses one request at a time, a configured
  delay and identifying User-Agent, bounded retry/backoff, response limits, and a host circuit
  breaker. It parses only Team ranking plus recent/career Rating fields.
- Parser drift fails closed, records a failed `sync_run`, and stores no partial ranking snapshot.
  Partial Player-stat batches retain successes and list per-identity failures.
- Raw response bodies are neither logged nor stored. Only normalized data, parser version, source
  freshness metadata, and SHA-256 checksum are persisted.

## Approval and Pool draft flow

1. A ranking sync writes an unapproved immutable `ranking_source_snapshot`.
2. Admin inspects its source, freshness, parser version, record count, and checksum, then explicitly
   approves it with a reason and audit row. The guarded CLI equivalent is
   `pnpm source:approve-ranking -- --snapshot <id> --actor <admin> --reason <text> --apply
--confirm-ranking-source`; omitting the apply/confirmation inputs is review-only.
3. `pnpm job:build-pool-draft -- --edition 2026` reads only the latest approved HLTV and VRS
   snapshots. Missing or stale sources stop/fail the job. An HLTV roster disagreement remains a
   blocking conflict. A VRS disagreement is retained as a warning because the Owner selected HLTV
   as current-roster authority.
4. The generator reports existing entries and would-be removals but never removes anyone. It writes
   qualifying additions as `PENDING` proposals under the exact Gate D contract.
5. Admin separately reviews each Pool proposal. Approval revalidates current state and evidence
   before using the ordinary audited Pool service.

Existing Manual/Special entries are database inputs, not source-code configuration. A newer draft
supersedes older still-pending proposals for the Edition but never deletes history.

An unmatched source Team in ranks 1–12 remains a blocking identity conflict. An unmatched VRS Team
in ranks 13–20 is a warning when no qualifying 2026 Event evidence exists: rank alone does not make
that Team eligible under Review Auto. Import the Team/Event evidence and regenerate if it should be
considered; never infer eligibility from a name-only row.

## Reviewed HLTV fallback

The normal HLTV adapter remains the preferred path. During the August 14 local rehearsal, the
initial deliberate bounded request, a later Owner-requested retry, and a third retry after the Owner
restarted the affected network path were each denied with HTTP 403 for the official August 10
ranking even though the page remained accessible in the Owner's ordinary browser. All three jobs
failed closed, recorded separate failed `sync_run` rows, and stored no partial snapshot. To keep an
auditable rehearsal path without weakening the adapter,
`data/reviewed-sources/hltv-ranking-2026-08-10-top12.json` contains the manually reviewed official
top 12 used by the approved canonical sheet.

`pnpm source:import-reviewed-hltv` validates that file and prints its SHA-256 without connecting to
the database. Apply requires an active Admin, reason, `--apply`, and
`--confirm-reviewed-source`. A reviewed input must use an exact official dated HLTV ranking URL,
match its publication date, and contain either every rank 1–12 or every rank 1–20 exactly once,
with unique Team IDs and exactly five unique starters per Team. The immutable snapshot is labeled
`hltv-reviewed-top12-json-v1` or `hltv-reviewed-top20-json-v1` so downstream review cannot confuse
Core-only coverage with Review Auto coverage. The current checked-in August 10 input is still only
top 12. It is an explicit manual fallback, not proof that automated HLTV retrieval worked, not
top-20 evidence, and not Player-stat evidence. Retry the low-frequency live adapter near Railway
cutover; if it is still blocked, Owner review of a fresh checksum-locked fallback is required again.

The same access boundary applies independently to Player stats. On August 15, an identified direct
request to the official three-month Player-stats URL returned HTTP 403, while the ordinary browser
loaded the page and exposed the current Rating 3.0 and Maps Played presentation. The live page no
longer exposes the synthetic `rating_3_0` / `recent_maps` labels used by the saved parser fixture, so
the direct adapter remains fail-closed and must not be treated as current production evidence.

`pnpm source:import-reviewed-hltv-stats -- --file <local-json>` is the guarded manual fallback. The
input stays Git-ignored because it is frequently refreshed operational evidence. Dry run validates
its checksum, exact period, unique IDs, and exact official per-Player URLs without a database. Apply
also requires an active Admin, reason, `--apply`, and `--confirm-reviewed-stats`; one transaction
requires exact coverage of every configured HLTV Player identity, rejects ID/slug drift and duplicate
capture timestamps, writes only the metrics actually observed, and records one Admin audit. Recent
and career evidence are separate: missing career data remains `—` rather than being inferred from a
three-month page. This fallback does not make the live `HLTV_SYNC_ENABLED` adapter succeed or bypass
HLTV Cloudflare controls.

Fill the ignored JSON without hand-copying 70 identities, URLs, or Rating/maps values. The current
operator playbook is `docs/HLTV_PLAYER_STATS.md`.

```bash
pnpm source:capture-reviewed-hltv-stats -- \
  --start YYYY-MM-DD --end YYYY-MM-DD \
  --output data/reviewed-sources/hltv-player-stats-local.json
```

The capture CLI uses local Playwright Chromium, one request at a time, against each official
`/player/{id}/{slug}` profile. Those pages currently expose HLTV's own `Past 3 months • N maps`
window, Rating 3.0, Firepower (`N/100`), **Majors won**, **Total MVPs**, the **Top 20 overview**
table, and the profile flag (ISO-2). Direct `/stats/players/` URLs and the gigobyte/HLTV scraper
remain Cloudflare-blocked from Node; this path does not retry them, spoof a challenge, or enable
`HLTV_SYNC_ENABLED`. Round Swing, career Rating, and ADR stay missing because they are not on the
player profile. Default delay is 8 seconds. A single retry waits 20 seconds after HTTP 403/429, and
three consecutive denials stop the rest of the batch. `--resume` continues an interrupted
**current-schema** file without re-fetching identities that already have recent metrics. A v1/v2
JSON without `top20Placements` / `countryCode` cannot be resumed; recapture with `--force` and a new
`capturedAt`. Do not substitute **Majors played** or **Major MVPs**, and do not infer nationality
from the current team. The stored `recentSourceUrl` remains the official dated stats URL so the
importer's identity/period contract is unchanged; the capture page is the profile that actually
loaded. Parser version `hltv-player-profile-stats-html-v3` fails closed on Cloudflare HTML or missing
Past 3 months Rating 3.0 / maps. Top 20 and nationality fail open to empty/null. The command refuses
to overwrite an existing file unless `--force` or `--resume` is passed. `--player-id` is debug-only.
Never run this capture from CI.

This capture is a deliberate local refresh, not an automatic roster hook. Adding or replacing a
Pool player does not recapture HLTV stats. After the configured HLTV identity set changes, re-run
capture (or `--resume` for only the new IDs once the template covers them) and the guarded importer.
Keep `HLTV_SYNC_ENABLED=false`; public requests never fetch HLTV.

`pnpm source:create-reviewed-hltv-stats-template` remains available if a review pass must start from
an empty 70-identity file. It is convenience, not evidence by itself.

## Canonical bootstrap boundary

`data/canonical/2026-beta.json` closes the gap between ranking-source rows and the canonical
Team/Player/roster records those rows must resolve against. It is an Owner-reviewed bootstrap input,
not a provider proposal and not Pool approval. `pnpm canonical:bootstrap` is dry-run validation by
default. Apply requires an Owner-approved manifest, an active Admin, both explicit apply/confirmation
flags, and empty product tables; it creates audited canonical records atomically and leaves the
Edition DRAFT with an empty Candidate Pool. See `docs/CANONICAL_BOOTSTRAP.md`.

The Owner-approved canonical input uses the 14-Team union of the listed August 3 Valve and August 10
HLTV top-12 snapshots. The Owner decided on August 14 that HLTV is the canonical current-roster
authority when the two sources disagree, while sync/draft processing must still expose each
disagreement as a warning. Both sources are within the default 14-day threshold on August 14;
activation still
requires newly synchronized and approved evidence close to the actual cutover.

The Gate D receiving boundary remains unchanged:

- public recent Rating, Firepower, ADR, career Rating, Majors won, Total MVPs, and Top 20 rank
  projections select only `HLTV` snapshots and label Rating fields as HLTV Rating; metrics from
  `OTHER`, BO3, PandaScore, or Liquipedia cannot silently occupy those fields. Nationality is
  `player.country_code`, filled by the same reviewed import when the profile flag is present;
- imported identity, entity, roster, Event/result, and Pool proposals use the exact version-1
  contract in `docs/ADMIN_CONSOLE.md`;
- automatic Pool Team proposals include ranking/event evidence and are re-evaluated on approval;
- no Edition transition is an accepted provider proposal; and
- proposal application and runtime cache invalidation occur only after explicit reviewed commit.

## Freshness and assets

`EXTERNAL_SOURCE_MAX_AGE_DAYS` controls Pool-source freshness (default 14 days).
`EXTERNAL_STATS_STALE_AFTER_HOURS` controls public HLTV stat labeling (default 48 hours). Missing or
stale stats remain honest UI states and never block voting.

Player photos and Team logos remain local. Tracked `assets/registry.json` supplies each asset path
and honest rights state to launch readiness; ignored `assets/attribution.json` keeps the exact source
and detailed notes only for local Dev/Ops review. The Owner may accept provisional community-beta
use as a warning while handling license questions separately. Run `pnpm assets:check` locally;
never hotlink runtime assets. The source, normalization, and replacement plan is defined in
`docs/IMAGE_SOURCING.md`. Uniform HLTV player portraits follow `docs/HLTV_PROFILE_PORTRAITS.md`.

Before Edition activation, `pnpm launch:check -- --edition <code>` additionally requires the latest
approved HLTV/VRS snapshots to be within `EXTERNAL_SOURCE_MAX_AGE_DAYS`, and the latest successful
Pool-draft run for that Edition to record those same source publication times. A newer approved
snapshot therefore invalidates an older launch report until the Pool draft is regenerated and its
proposals are reviewed. Missing optional Player stats remain a warning, not a voting dependency.

`player.hltv_profile_url` is an optional human-facing reference displayed on the Player page. It is
not fetched during a public request and is not a replacement for the verified HLTV
`player_external_identity` used by adapters and launch readiness.
