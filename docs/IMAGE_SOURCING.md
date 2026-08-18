# Image sourcing and import plan

M10 needs 14 Team logos and 70 Player portraits. The small community beta may use a real image after
the Owner accepts the source, even when external license work is still pending. The repository must
describe that state honestly; it must not claim that permission was granted when it was not.

The public site always serves a local optimized copy. It never hotlinks an external image during a
page view, so a provider outage or changed URL cannot break voting.

## Source-record visibility

`assets/attribution.json` is local developer/operations metadata. It is ignored by Git, excluded
from Docker images, and never read by the public product. No Vote, Ranking, Player, About, or Admin
screen renders its source URLs or notes. The tracked `assets/registry.json` contains only each local
asset path and its permission/review state so deployed launch readiness can still detect missing or
pending-rights assets without publishing detailed provenance.

This is a deliberate privacy boundary for provenance, not security-through-obscurity. Do not add a
public route, client import, Admin table, or serialized API field for the attribution entries. A
local asset path may of course be public so the image can render; its source URL,
author/rightsholder, and review notes remain development-side records.

The local file is not a backup. Preserve it with the Owner's private operational evidence before
changing machines or cleaning the workspace. `assets/attribution.example.json` documents the empty
shape without exposing real records.

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

Preferred target output is an 800×1000 WebP portrait at `/images/players/{player-slug}.webp`. Keep
the face and upper body within the central safe area; apply the same crop ratio and background
treatment across teams. Do not upscale a visibly low-resolution source merely to meet the nominal
dimensions. The current complete HLTV set is the provider's consistent native 200×200 body-shot
transform and is retained at that size rather than artificially enlarged.

Owner-provided Special portraits may arrive at a different size or as a JPEG saved with a `.webp`
name. Production sends `X-Content-Type-Options: nosniff`, so the file must be real WebP bytes.
Square Vote/Ranking/Player frames use `object-fit: cover` and `object-position: center top`; a
taller studio photo should be top-aligned into a square (800×800 is enough) so the head stays in
frame. Do not force-downsample a sharp Owner photo to the HLTV 200×200 size. Keep the exact
filename, including case (`MachineWJQ.webp`).

## Source and rights record

Every imported file receives one ignored `assets/attribution.json` entry containing the exact source
URL, the observed author/rightsholder when available, review notes, and one honest status. It also
receives a tracked `assets/registry.json` entry containing only the same local path and status:

- `LICENSED` — the stated license covers the use;
- `PERMISSION_GRANTED` — the rightsholder provided permission;
- `OWNER_PROVIDED` — the Owner supplied an asset they are entitled to provide; or
- `OWNER_ACCEPTED_PENDING_RIGHTS` — the Owner approved provisional community-beta use and will
  handle any required license or permission later.

The last status does not claim ownership or permission. `pnpm launch:check` reads the tracked
registry and reports it as a warning, not a blocker. Local `pnpm assets:check` additionally requires
the exact source URL and exact registry/record agreement so the asset can be reviewed or replaced.

## Import phases

1. **Logo pass:** collect and normalize all 14 logos first. This immediately improves Vote, Ranking,
   and Player views with a small download/storage footprint. Admin continues to manage the path
   without exposing Dev/Ops provenance.
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

The 14-logo pass is complete in the repository. Every canonical Team has a locally served path, a
minimal tracked `OWNER_ACCEPTED_PENDING_RIGHTS` registry entry, and an exact ignored local source
record captured from the official August 10 HLTV ranking page. `pnpm assets:check` passes, and the
public Vote, Ranking, and Player projections render the logo when the database contains that path.
Four SVG sources were rendered locally to transparent PNG; the remaining signed raster responses
are stored as their actual WebP format.

The 70-portrait pass is complete. A fresh browser verification proved that HLTV lazy-loads five
portraits only after each Team accordion is opened; the original Falcons-only result reflected the
default open accordion, not missing assets. Opening every canonical Team loaded 70/70 images. The
browser exporter retained only a bounded subset per inventory, so the images were exported as three
identity-verified batches of 30, 20, and 20, each with zero failures.

`assets:import-hltv-portraits` joined the browser capture to the canonical manifest by exact HLTV
Player ID, profile slug, Team, and nickname, then joined exact source URL to each bundle manifest.
It imported 70 WebP files, configured all 70 `photoPath` values, added 70 minimal tracked registry
entries, and added 70 detailed records only to the ignored local attribution file. Filesystem,
canonical, registry, and local-source counts then agreed at 70 Core portraits / 14 logos / 84
pending-rights assets.

On 2026-08-18 a second portrait pass captured official HLTV **player-profile** body shots for the 20
Review Manual starters plus advent (`pnpm assets:capture-hltv-profile-portraits`). The profile page
stores the image on `data-cookieblock-src`; capture fetches that `img-cdn.hltv.org/playerbodyshot/`
URL in-page, converts PNG to real WebP, and writes ignored local evidence. Import copies the 21
files into `public/images/players/{slug}.webp`, appends registry/attribution, and sets manifest
`photoPath` values. MachineWJQ remains `OWNER_PROVIDED`. Production `photoPath` is applied with
`pnpm players:apply-photos`. Counts after portraits: 92 player portraits / 14 logos / 105
pending-rights assets / 1 Owner-provided portrait. Representative Review Manual and advent crops
were visually reviewed. Square UI frames still use `object-fit: cover` and
`object-position: center top` because profile body shots are slightly taller than square.

On 2026-08-18 a Review Manual logo pass captured official HLTV **team-page** marks for BC.Game,
100 Thieves, TYLOO, and Lynn Vision (`pnpm assets:capture-hltv-team-logos`). Capture prefers the
night-only variant when HLTV splits day/night (the public team-logo container is always `#202936`),
fetches `img-cdn.hltv.org/teamlogo/` in-page, converts raster PNG to real WebP, and renders SVG
sources locally to transparent 512×512 PNG. Import copies the files into `public/images/teams/`,
appends registry/attribution, and sets manifest `logoPath` values. Production `logoPath` is applied
with `pnpm teams:apply-logos`. Counts: 92 player portraits / 18 logos / 109 pending-rights assets /
1 Owner-provided portrait.

The preserved local rehearsal databases were bootstrapped before both asset passes and still contain
null image paths. A fresh canonical bootstrap/reset will receive the Core 84 configured paths; do not
describe the old rehearsal report as evidence that the post-asset database was tested.
