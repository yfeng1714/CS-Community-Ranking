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
three-month page. This fallback does not make the browser export automatic or bypass HLTV controls.

Start a review pass without hand-copying 70 identities or URLs by running
`pnpm source:create-reviewed-hltv-stats-template -- --captured <ISO-time> --start YYYY-MM-DD --end
YYYY-MM-DD --output <ignored-json>`. It creates one exact record for every canonical HLTV identity,
with all metrics explicitly `null` and the exact period-specific official URL. It refuses to
overwrite an existing file. Fill only values actually observed, retain `null` for unavailable data,
then use the guarded importer above. The template is convenience, not evidence by itself.

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

- public recent/career Rating projections select only `HLTV` snapshots and label them as HLTV
  Rating; metrics from `OTHER`, BO3, PandaScore, or Liquipedia cannot silently occupy that field;
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
`docs/IMAGE_SOURCING.md`.

Before Edition activation, `pnpm launch:check -- --edition <code>` additionally requires the latest
approved HLTV/VRS snapshots to be within `EXTERNAL_SOURCE_MAX_AGE_DAYS`, and the latest successful
Pool-draft run for that Edition to record those same source publication times. A newer approved
snapshot therefore invalidates an older launch report until the Pool draft is regenerated and its
proposals are reviewed. Missing optional Player stats remain a warning, not a voting dependency.

`player.hltv_profile_url` is an optional human-facing reference displayed on the Player page. It is
not fetched during a public request and is not a replacement for the verified HLTV
`player_external_identity` used by adapters and launch readiness.
