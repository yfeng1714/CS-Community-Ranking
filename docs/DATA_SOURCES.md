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
   approves it with a reason and audit row.
3. `pnpm job:build-pool-draft -- --edition 2026` reads only the latest approved HLTV and VRS
   snapshots. Missing sources stop the job; stale sources and roster disagreement become conflicts.
4. The generator reports existing entries and would-be removals but never removes anyone. It writes
   qualifying additions as `PENDING` proposals under the exact Gate D contract.
5. Admin separately reviews each Pool proposal. Approval revalidates current state and evidence
   before using the ordinary audited Pool service.

Existing Manual/Special entries are database inputs, not source-code configuration. A newer draft
supersedes older still-pending proposals for the Edition but never deletes history.

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

Player photos and Team logos remain local. `assets/attribution.json` is the versioned manifest;
every asset must be owner-provided, licensed, or have documented permission. Run
`pnpm assets:check`; never hotlink or automatically copy provider assets.
