# API Notes

The complete V0.1 API contract remains in `docs/IMPLEMENTATION_PLAN_V0.1.md`.

## Implemented in Milestone 0

- `GET /api/health/live` — process liveness; returns `200` and no internal details.
- `GET /api/health/ready` — validates PostgreSQL connectivity; returns `200` or detail-free `503`.

Both health responses use `Cache-Control: no-store`. Public mutation APIs are intentionally deferred
until Milestone 3. Reusable method, JSON content-type, Origin, and Fetch-Metadata validation exists
under `src/security/` and must wrap each future mutation route.

Milestone 2 adds domain services and trusted local Pool CLI commands, not HTTP endpoints. This keeps
business rules independent of Next.js and lets the later Admin routes call the same audited service
layer.
