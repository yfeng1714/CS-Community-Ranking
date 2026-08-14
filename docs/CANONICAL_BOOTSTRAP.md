# Canonical 2026 Beta bootstrap

`data/canonical/2026-beta.json` is the reviewable initial real-data proposal for the clean M10
database. It is not a provider import, a seed, or an approved Candidate Pool. It contains the DRAFT
Edition, 14-Team union of the listed Valve/HLTV top-12 snapshots, five observed current starters per
Team, and direct HLTV Team/Player identities. Pool admission still follows the source snapshot,
draft, conflict, and individual Admin-review workflow.

## Review state

The Owner approved the committed manifest on 2026-08-14 for empty-database bootstrap and local
rehearsal. Validate and summarize it without a database:

```bash
pnpm canonical:bootstrap
```

The command prints its SHA-256, Edition code, observation date, Team/Player counts, and review state.
It performs no database connection or mutation in this mode. The August 3 Valve and August 10 HLTV
sources are both within the current 14-day threshold on August 14. They can support rehearsal, but
production still requires fresh synchronized and explicitly approved snapshots close to activation.

The manifest records `review.status: OWNER_APPROVED`, reviewer `owner`, and the review timestamp.
That approval does not admit the Candidate Pool or activate the resulting DRAFT Edition.

## Apply boundary

After migrations and `admin:create` have created the only initial active Admin in an otherwise empty
database:

```bash
pnpm canonical:bootstrap -- --manifest data/canonical/2026-beta.json \
  --actor owner --apply --confirm-canonical-bootstrap
```

The apply path fails unless all of the following are true:

- the manifest is structurally valid and explicitly Owner-approved;
- the named Admin exists and is active;
- `--apply` and `--confirm-canonical-bootstrap` are both present; and
- Edition, Team, Player, roster, and Team/Player identity tables are empty.

One outer transaction creates the DRAFT Edition, Teams, Players, HLTV identities, exactly five
STARTER observations per Team, and all ordinary Admin audit rows. Any failure rolls the whole set
back. It deliberately does not activate the Edition, admit any Pool entry, run a source sync, approve
a snapshot/proposal, or copy an external image.

## Local rehearsal evidence — 2026-08-14

The then-approved, pre-asset manifest was applied to the isolated local database
`csr_m10_rehearsal_20260814`, not to Railway. It created one DRAFT Edition, 14 Teams, 70 Players, 70
current five-player roster memberships, 84 HLTV Team/Player identities, and 239 audit rows while
leaving both Pool tables empty. The dry-run manifest SHA-256 was
`276c5c473f518a2e8247e73054f8bf7a401f7827e1fc34fdf2940ae9d95e330e`. That checksum is retained as
historical rehearsal evidence; after the Owner-approved Team-logo pass, the current manifest
checksum is `fbefb0cdb3b637367c9d4deb85fa04837d50f5d5f1e9e639aea46fd9240bf572`.

A live official August 3 Valve sync and an audited reviewed August 10 HLTV fallback were then
approved locally. The regenerated Pool draft completed `SUCCEEDED` with 14 conflict-free proposals.
The Owner approved that exact set on August 14 through the ordinary Gate D service, producing 14
Core Team entries, 70 pairing-enabled starters, 70 zeroed rankings, 14 proposal-review audits, 14
Team admission logs, and 70 Team-player admission logs. Its ten retained warnings comprise six
unmatched VRS rank-13–20 Teams without qualifying Event evidence plus four VRS/HLTV roster
differences resolved under the Owner-approved HLTV-authority rule.

`launch:check` then passed with `blocking: false`, 2,415 possible pairs, and only the expected
placeholder-image and optional-stat warnings. The canonical rehearsal Edition remains DRAFT and
zeroed. A separate `csr_m10_ui_preview_20260814` clone was activated solely for local public-UI
inspection so preview Ballots cannot pollute the canonical rehearsal. Production must repeat this
process with fresh evidence; these local rows are rehearsal proof only.

Roster `startsAt` uses the observation date as a conservative lower bound. It means “verified as a
current starter from this date,” not an invented historical signing date. Later verified changes use
normal roster history services.

## Image import boundary

Image sourcing is a separate, replaceable pass. The current manifest configures all 14 local Team
logo paths with matching tracked registry entries and ignored local attribution records, and keeps
all 70 Player photo paths null.
Unfinished external rights review is recorded honestly as `OWNER_ACCEPTED_PENDING_RIGHTS` and
reported as a warning rather than a blocker. `pnpm assets:check` validates every configured path;
unconfigured Player portraits use neutral monograms. No runtime hotlinking is allowed. See
`docs/IMAGE_SOURCING.md`.
