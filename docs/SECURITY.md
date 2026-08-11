# Security Notes

## Milestone 0 controls

- Startup environment values are validated with Zod; invalid required configuration fails startup.
- Production placeholder secrets and non-`__Host-` visitor cookie names are rejected.
- Request IDs accept only a bounded safe character set before entering logs.
- Pino emits structured JSON and redacts cookies, tokens, passwords, and database URLs.
- The mutation guard requires POST and JSON, rejects cross-site Fetch Metadata, and validates Origin
  in production.
- Health endpoints reveal only liveness/readiness state and never database error details.

## Milestone 3 controls

- Visitor identity uses a 32-byte cryptographically random base64url token. PostgreSQL stores only
  its HMAC-SHA-256 digest under the configured pepper.
- The visitor cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, has no `Domain`, and uses the
  production-enforced `__Host-` prefix.
- `POST /api/v1/ballots/next` is wrapped by the shared JSON, Origin, and Fetch-Metadata mutation
  guard; all responses are `no-store`.
- Unexpected issuance errors return no database details. Logs record only a bounded safe error code,
  never raw visitor tokens or cookies.
- The availability limiter has configurable request and key bounds with TTL/LRU eviction. Ranking
  quota and one-open-Ballot correctness remain in PostgreSQL.
- Internal suspicious eligibility is not disclosed before resolution, preventing a risk feedback
  oracle.

## Deferred controls

Admin authentication, broader security headers, IP-risk processing, retention jobs, and abuse
enforcement are implemented in their scheduled milestones. Vote resolution receives the same
mutation guard in M4. Their invariants remain defined by the Implementation Plan.

Never add a raw IP, visitor cookie, Admin token, password, or complete provider HTML body to logs.
