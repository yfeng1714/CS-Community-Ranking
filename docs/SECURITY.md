# Security Notes

## Milestone 0 controls

- Startup environment values are validated with Zod; invalid required configuration fails startup.
- Production placeholder secrets and non-`__Host-` visitor cookie names are rejected.
- Request IDs accept only a bounded safe character set before entering logs.
- Pino emits structured JSON and redacts cookies, tokens, passwords, and database URLs.
- The mutation guard requires POST and JSON, rejects cross-site Fetch Metadata, and validates Origin
  in production.
- Health endpoints reveal only liveness/readiness state and never database error details.

## Deferred controls

Cookie issuance, visitor token hashing, Admin authentication, CSRF integration on real mutation
routes, security headers, IP-risk processing, retention jobs, and abuse enforcement are implemented
in their scheduled milestones. Their invariants remain defined by the Implementation Plan.

Never add a raw IP, visitor cookie, Admin token, password, or complete provider HTML body to logs.
