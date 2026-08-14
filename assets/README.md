# Local image attribution

Player photos and Team logos are copied into `public/images/players` or `public/images/teams` and
must have one matching entry in tracked `registry.json` and one detailed source record in local
`attribution.json`. Runtime hotlinking remains prohibited.

`attribution.json` is intentionally ignored by Git and excluded from Docker images. Start from
`attribution.example.json`; keep the exact source URL, rights notes, and matching permission state
only in the local file. `registry.json` contains just the asset path and launch review state required
by deployed readiness checks. The two files must contain the same paths and permission values.

For the small community beta, the Owner may explicitly accept provisional use before external rights
review is finished. Record that honestly as `OWNER_ACCEPTED_PENDING_RIGHTS`; do not label it licensed
or permission-granted. This state is a launch warning rather than a technical blocker and can be
replaced with a cleared asset later.

See `docs/IMAGE_SOURCING.md` for source priorities, dimensions, naming, import phases, and the
replacement workflow.

Run `pnpm assets:check` locally before committing asset changes. It fails unless the local detailed
records, tracked registry, and files under `public/images` agree exactly.

For a reviewed HLTV browser capture, `pnpm assets:import-hltv-portraits -- --capture <file>
--bundles <dir,...>` validates all 70 Player IDs, profile slugs, Team assignments, nicknames, source
URLs, bundle membership, and WebP content types before copying or updating any manifest.
