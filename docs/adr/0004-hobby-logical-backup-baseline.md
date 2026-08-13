# ADR 0004: Use Hobby logical backups for the early product

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owner:** Project Owner

## Context

Railway's Hobby plan is the approved low-cost baseline for a new product whose traffic and value are
not yet known. The staging dashboard does not expose the desired managed volume-backup/PITR path
without a Pro upgrade. The repository already has guarded PostgreSQL custom-dump and restore
verification commands, and a private Railway restore drill matched all critical-table counts.

The owner has more than 300 GB of local capacity and explicitly approved local storage. Capacity is
not the main risk: a backup that exists only on the same laptop is still vulnerable to loss, theft,
disk failure, or accidental deletion.

## Decision

Use Railway Hobby plus logical PostgreSQL backups for the early product. Do not upgrade to Pro only
to satisfy the original volume-backup row.

- While staging contains only fictional/rebuildable data, create a logical backup at least weekly
  and before consequential migrations or data imports.
- From the first closed-beta or other meaningful real Vote onward, create a backup at least daily.
- Retain seven daily recovery points and four weekly recovery points once daily backups begin.
- Store the working copy under the ignored local `backups/` directory. Never commit a dump or its
  manifest.
- Keep a second independent, access-controlled copy before real public launch. It may be an existing
  encrypted owner backup destination or private object storage; the provider is deliberately not
  coupled to the application.
- Verify a retained backup through a separate empty database at least monthly and after any material
  schema change.
- Use PostgreSQL client tools matching the Railway server major version and a Railway SSH tunnel so
  the database does not need permanent public exposure.

The operational target after real voting begins is a maximum 24-hour data-loss window (RPO) and a
four-hour manual recovery target (RTO). These targets must be revisited when actual usage or business
importance makes them inadequate.

## Alternatives considered

- **Railway Pro volume backups/PITR now:** simpler and faster recovery, but raises the minimum plan
  commitment before the product has meaningful data or demand.
- **Local-only backup indefinitely:** lowest immediate effort, but one device failure could remove
  both the working environment and every recovery copy.
- **No retained backup until launch:** rejected because a successful one-time restore drill does not
  protect data created afterward.

## Consequences

- The staging plan remains low cost and the backup format remains portable across providers.
- Recovery is operator-driven and may lose changes since the most recent dump.
- Local disk usage will be negligible initially; retention must still be enforced as data grows.
- Gate E may accept the lack of Railway volume backups, but it remains pending until the first
  retained dump, cadence, second-copy destination, and recovery targets are evidenced.
- Revisit Pro/PITR when the 24-hour RPO or four-hour RTO is no longer acceptable, or when recovery
  labor costs more than the plan upgrade.

## Validation

- `pnpm backup:create` completes with a matching PostgreSQL client.
- `pnpm backup:verify` restores into a separate empty database and matches all critical-table counts.
- `docs/STAGING_GATE_E.md` records dump age, size, storage class, restore duration, and retention
  evidence without recording credentials or private data.
