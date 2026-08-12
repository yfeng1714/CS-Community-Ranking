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
  per-process login limiter defaults to five attempts per minute per direct client key.
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

- Team create/update and reversible active status.
- Player create/update and professional status.
- Roster membership creation and explicit end dates.
- Edition creation and forward-only `DRAFT → ACTIVE → FROZEN → ARCHIVED` transitions.
- Event creation and one-way confirmed T1 whitelist decisions.
- Manual Team admission, Special Player admission, and reversible pairing eligibility.
- Pending imported-change approval/rejection.
- Vote revocation with counter rollback.

There is no physical-delete control. Pool admissions and Votes remain historical records. Pairing
disable and Vote revoke are explicit state transitions with reasons.

All browser mutations use `POST /api/v1/admin/mutate` with exact JSON. The server rejects non-JSON,
cross-site Fetch Metadata, and mismatched Origin requests before authentication, then injects the
actor from the verified session rather than accepting an actor ID from the browser.

## Audit model

Every successful mutation writes a general `admin_audit_log` in the same PostgreSQL transaction as
its state change. Pool mutations also write `pool_change_log`; Vote revocation also writes
`moderation_audit_log`. Each record identifies actor, action, target, reason, time, and relevant
before/after state. Failed transactions leave neither product changes nor successful audit rows.

The Audit screen shows the three logs separately, plus sync-run status, record counts, error
summaries, and parser metadata. The dashboard shows the active Edition, Team/Player pool counts,
the full score-integrity report, pending proposal count, and last sync state.

## Pending imported-change safety

M7 adapters will populate `pending_import_change`. M6 defines the review envelope now:

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
6. reloads and compares current database state with `expectedState`;
7. applies the normal audited domain service under a nested savepoint; and
8. marks the proposal approved with reviewer, reason, and applied time.

Rejection records reviewer and reason but applies no product change. Supported imported actions are
Team/Player create or update, Roster add/end, Event create/whitelist, Pool Team admission, Pool
Player admission, and pairing state. M7 must emit this contract or deliberately version it in docs
and tests.

## Search-engine and response treatment

Admin pages are dynamic and `no-store`. Metadata and response headers specify noindex/nofollow;
Admin responses also deny framing, disable MIME sniffing, and use no-referrer. These protections do
not replace authentication. The broader site-wide security-header pass remains scheduled for M8.
