# Local image attribution

Player photos and Team logos are copied into `public/images/players` or `public/images/teams` and
must have one matching source record in `attribution.json`. Runtime hotlinking remains prohibited.

For the small community beta, the Owner may explicitly accept provisional use before external rights
review is finished. Record that honestly as `OWNER_ACCEPTED_PENDING_RIGHTS`; do not label it licensed
or permission-granted. This state is a launch warning rather than a technical blocker and can be
replaced with a cleared asset later.

See `docs/IMAGE_SOURCING.md` for source priorities, dimensions, naming, import phases, and the
replacement workflow.

Run `pnpm assets:check` before committing asset changes.
