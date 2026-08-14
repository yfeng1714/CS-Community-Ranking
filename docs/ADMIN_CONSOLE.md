# Admin Console

Milestone 6 provides the private, same-origin operator surface at `/admin`. It is intentionally not
a public account system: there is no registration, password reset, email flow, or client-readable
session state.

## Account and session contract

- Create an account only from a trusted host with `pnpm admin:create -- --username=<name>`. The CLI
  hides password input on a TTY and reads stdin when piped. Passwords must be 12–1024 characters.
- Passwords are stored as Argon2id PHC strings using `argon2` with 19 MiB memory, two iterations,
  and one lane. The raw password is never stored or logged.
- Login failures use the same message for missing, inactive, and wrong-password accounts. A bounded
  per-process login limiter defaults to five attempts per minute per direct client key. Proxy
  identity headers are ignored unless `TRUST_PROXY_HEADERS=true`; trusted deployments must
  explicitly choose Railway or Cloudflare header semantics with `CLIENT_IP_MODE`.
- The browser receives a random 32-byte base64url token. PostgreSQL stores only its HMAC-SHA-256
  digest under `ADMIN_SESSION_SECRET`.
- The default session lifetime is 12 hours. The cookie is `Secure`, `HttpOnly`, `SameSite=Strict`,
  `Path=/`, has no `Domain`, high priority, and uses the production-enforced `__Host-` prefix.
- Every protected page query and API mutation verifies the database session, expiry, revocation,
  and current Admin active state. Logout revokes the database row and clears the cookie.

The initial CLI account creation is the one bootstrap operation that cannot reference an existing
Admin actor. Successful login/logout and every product-data mutation write `admin_audit_log` rows.

## Mutation surface

The console manages the following without a deployment:

- Team create/update, logo path, reversible active status, and provider identities.
- Player create/update, image path, optional validated HLTV profile URL, professional status, and
  provider identities. The profile URL is for human reference; provider identity remains the sync
  key.
- Roster membership creation and explicit end dates.
- Edition creation and forward-only `DRAFT → ACTIVE → FROZEN → ARCHIVED` transitions. The M10
  `DRAFT → ACTIVE` path first re-runs the fail-closed launch-readiness report and refuses any
  blocker; the Owner still completes the operational Gate F sign-off.
- Event creation, one-way confirmed T1 whitelist decisions, and Team placement results.
- Manual Team admission, Special Player admission, newly signed formal starters from an already
  admitted Team, and reversible pairing eligibility.
- Pending imported-change approval/rejection.
- Exact-ID Vote search and revocation with counter rollback.

There is no physical-delete control. Pool admissions and Votes remain historical records. Pairing
disable and Vote revoke are explicit state transitions with reasons.

All browser mutations use `POST /api/v1/admin/mutate` with exact JSON. The server rejects malformed
or non-JSON bodies, unknown fields, IDs outside the positive signed PostgreSQL-bigint range,
cross-site Fetch Metadata, and mismatched Origin requests, then injects the actor from the verified
session rather than accepting an actor ID from the browser. Known uniqueness, reference, range, and
check-constraint failures receive safe `400`/`409` responses without database details.

## Audit model

Every successful mutation writes a general `admin_audit_log` in the same PostgreSQL transaction as
its state change. Pool mutations also write `pool_change_log`; Vote revocation also writes
`moderation_audit_log`. Each record identifies actor, action, target, reason, time, and relevant
before/after state. Failed transactions leave neither product changes nor successful audit rows.

The Audit screen shows the three logs separately with inspectable before/after state, plus sync-run
status, record counts, error summaries, and parser metadata. The dashboard shows the active Edition,
Team/Player pool counts, the full score-integrity report, an untruncated pending proposal count, and
last sync state.

## Pending imported-change safety

M7 adapters populate immutable source snapshots and `pending_import_change`. Ranking sources require
a first explicit Admin approval; generated Pool proposals require a separate second review. M6's
review envelope remains the exact application contract:

```json
{
  "version": 1,
  "action": "team.create",
  "expectedState": null,
  "input": { "slug": "example-team", "name": "Example Team" }
}
```

Approval does not blindly replay old JSON. In one outer transaction it:

1. locks the pending row and requires `PENDING`;
2. rejects recorded conflict codes;
3. locks and requires a completed `SUCCEEDED` or `PARTIAL` source run;
4. rejects the proposal when a newer run exists for the same job/provider;
5. validates the versioned action and its change type;
6. reloads the canonical row by internal ID (or the create slug/composite key) and structurally
   compares its canonical JSON state with `expectedState`;
7. applies the normal audited domain service under a nested savepoint; and
8. marks the proposal approved with reviewer, reason, and applied time.

Rejection records reviewer and reason but applies no product change. Supported imported actions are
Team/Player create/update/external-identity upsert, Roster add/end, Event create/whitelist/result,
automatic Pool Team admission with complete evidence, team-derived or Special Pool Player
admission, and pairing state. Edition actions are deliberately unsupported. Pool proposal Edition
IDs must also match the pending envelope.

Imported automatic Team proposals must include `editionYear`, nullable HLTV/VRS ranks, and typed
event-result evidence. Approval re-evaluates that evidence and records the actual `CORE` or
`REVIEW_AUTO` category; it never converts imported automatic evidence into a Manual admission.
Likewise, a starter joining an admitted Team inherits that Team entry's category rather than being
stored as `SPECIAL`.

Runtime Pool cache invalidation occurs only after the outer approval transaction commits. Player
professional-status updates clear all in-process Pool snapshots; Edition-scoped Pool actions
invalidate their Edition. M7 must emit this exact contract or deliberately version it in docs and
tests.

For an Owner-reviewed explicit set, `pnpm pending:review -- --id <id>[,<id>...]` is a dry-run
summary. Apply requires the exact IDs plus `--actor`, `--reason`, `--apply`, and
`--confirm-pending-review`. It preflights that every selected row is still pending and conflict-free,
then reviews each through `PendingImportReviewService`, preserving the ordinary mutation, Pool, and
Admin audit rows. It never selects all pending work implicitly.

## Search-engine and response treatment

Admin pages are dynamic and `no-store`. Metadata and response headers specify noindex/nofollow;
Admin responses also deny framing, disable MIME sniffing, and use no-referrer. These protections do
not replace authentication. The broader site-wide security-header pass remains scheduled for M8.
