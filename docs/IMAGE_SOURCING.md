# Image sourcing and import plan

M10 needs 14 Team logos and 70 Player portraits. The small community beta may use a real image after
the Owner accepts the source, even when external license work is still pending. The repository must
describe that state honestly; it must not claim that permission was granted when it was not.

The public site always serves a local optimized copy. It never hotlinks an external image during a
page view, so a provider outage or changed URL cannot break voting.

## Source-record visibility

`assets/attribution.json` is developer/operations metadata, not public product content. It is outside
`public/`, no public API reads it, and no Vote, Ranking, Player, About, or Admin screen renders its
source URLs or notes. Launch readiness reads it server-side and reports only local asset paths plus
whether a rights review remains pending.

This is a deliberate privacy boundary for provenance, not security-through-obscurity. Do not add a
public route, client import, Admin table, or serialized API field for the attribution entries. A
local asset path may of course be public so the image can render; its source URL,
author/rightsholder, and review notes remain development-side records.

Repository visibility is a separate concern: if the GitHub repository is ever made public, tracked
source records are naturally visible to repository readers even though they are absent from the
website. Move detailed records to an owner-private evidence store before making the repository public
if that distinction becomes important.

## Source plan by asset type

### Team logos — 14 files

1. Prefer the Team's official brand/media kit or official website asset.
2. If no convenient kit exists, use the logo shown on the Team's canonical HLTV page as the
   provisional beta source. All 14 exact Team page URLs already live in
   `data/canonical/2026-beta.json`.
3. Use a suitable Wikimedia Commons/vector source when it is more complete or higher quality.
4. Fall back to a clean text/monogram mark only when the available logo is obsolete or unusable.

Target output: transparent 512×512 WebP or PNG at `/images/teams/{team-slug}.webp`. Preserve padding
so very wide and very tall marks appear visually balanced. Do not bake a light or dark background
into the logo.

### Player portraits — 70 files

1. Prefer a current official Team roster portrait or media-kit headshot.
2. Use the current portrait associated with the canonical HLTV Player profile as the consistent
   provisional source when the official Team source is absent or inconvenient. All 70 exact profile
   URLs and IDs already live in the canonical manifest.
3. Fall back to a recent tournament-organizer player portrait or press photograph.
4. Use a compatible Wikimedia Commons image when it is current and clearly identifies the Player.
5. Keep the neutral monogram only when no current, recognizable image can be obtained.

Target output: 800×1000 WebP portrait at `/images/players/{player-slug}.webp`. Keep the face and upper
body within the central safe area; apply the same crop ratio and background treatment across teams.
Do not upscale a visibly low-resolution source merely to meet the nominal dimensions.

## Source and rights record

Every imported file receives one `assets/attribution.json` entry containing the exact source URL,
the observed author/rightsholder when available, review notes, and one honest status:

- `LICENSED` — the stated license covers the use;
- `PERMISSION_GRANTED` — the rightsholder provided permission;
- `OWNER_PROVIDED` — the Owner supplied an asset they are entitled to provide; or
- `OWNER_ACCEPTED_PENDING_RIGHTS` — the Owner approved provisional community-beta use and will
  handle any required license or permission later.

The last status does not claim ownership or permission. `pnpm launch:check` reports it as a warning,
not a blocker. It always requires an exact source URL so the asset can be reviewed or replaced.

## Import phases

1. **Logo pass:** collect and normalize all 14 logos first. This immediately improves Vote, Ranking,
   Player, and Admin views with a small download/storage footprint.
2. **Portrait pass:** work Team by Team in canonical-manifest order, five Players at a time. Confirm
   the nickname/profile ID before attaching a portrait; never infer identity from filename alone.
3. **Manifest pass:** add source/right-status records during import rather than trying to reconstruct
   provenance later.
4. **Visual pass:** review Vote cards, Ranking rows, Player pages, mobile crops, and both themes.
5. **Freshness pass:** compare every portrait with the final HLTV-authoritative roster immediately
   before the Pool is approved. A former-player photo remains historical but must not be assigned to
   a replacement.
6. **Owner pass:** present the provisional-rights list separately. The Owner can clear, replace, or
   leave each entry pending for the community beta.

## Replacement and growth trigger

Source URL, local path, and rights status stay separate so an image can be replaced without changing
the Player/Team identity or ranking history. If a source becomes disputed, inaccurate, or outdated,
set its database path back to null and the existing monogram appears immediately.

Revisit the pending-rights list, a public contact route, and more formal asset policy when the
project gains a custom domain, materially broader usage, monetization, sponsorship, or outside
contributors.

## Current M10 state

The canonical DRAFT still has null paths for all 14 Team logos and 70 Player photos. No external
image has been imported yet. The next asset action is the 14-logo pass; roster/data rehearsal does
not need to wait for the later 70-photo pass.
