# Operations Runbook

## Local foundation

1. Copy `.env.example` to `.env` and replace placeholder secrets for any non-local environment.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install with `pnpm install --frozen-lockfile`.
4. Apply committed migrations with `pnpm db:migrate`.
5. Optionally load fictional local sample data with `pnpm db:seed`.
6. Start the application with `pnpm dev`.
7. Check `/api/health/live` and `/api/health/ready`.

The fictional seed activates its Edition only when no other Edition is active. Test M3 issuance from
the browser console with:

```js
await fetch("/api/v1/ballots/next", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
}).then((response) => response.json());
```

The first request creates a secure anonymous visitor cookie. Repeated requests return the same open
Ballot until M4 supplies resolve/skip or the configured TTL expires. These direct console calls are
transport-level retries. Once M4/M5 are complete, a true manual refresh of the voting page will
record the reused Ballot as Skip and immediately request a new pair.

If the default host port `5432` is occupied, set `POSTGRES_PORT` to an available
port in `.env` and use the same port in `DATABASE_URL`. PostgreSQL continues to
listen on port `5432` inside the container.

Run `pnpm test:integration` to create, migrate, test, and remove the isolated
`csr_integration_test` database. The configured development database is never dropped by this
lifecycle.

## Candidate Pool CLI

Milestone 2 provides trusted operational commands before the Admin UI exists:

```bash
pnpm pool:add-player -- --actor <admin-username> --edition <code> \
  --slug <player-slug> --nickname <nickname> --reason <public-reason>
pnpm pool:disable-player -- --actor <admin-username> --edition <code> \
  --player <player-slug> --reason <public-reason>
```

Run them only from a trusted host with database access. They write Pool Change Log and Admin Audit
Log rows. See `docs/CANDIDATE_POOL.md` for semantics and examples.

## Resource-conscious Docker use

Docker Desktop is required locally only when PostgreSQL or a production-container check is needed.
Unit tests, linting, type checking, and ordinary code editing do not require it.

```bash
docker compose up -d postgres   # start only for DB work
docker compose stop postgres    # stop the project database afterward
```

On macOS, quitting Docker Desktop after the container stops also shuts down its Linux VM and returns
its reserved CPU and memory. Start it again only for the next database or image validation session.

## Health meaning

- Liveness failure means the Node process cannot answer HTTP.
- Readiness failure means validated application startup or PostgreSQL connectivity is unavailable.
- A DRAFT/FROZEN Edition is product state, not process unhealthiness.

## Ballot issuance triage

- `NO_ACTIVE_EDITION`: activate exactly one prepared Edition; do not treat this as database failure.
- `POOL_NOT_READY`: confirm at least two Pool players are pairing-enabled and professionally active.
- `INFRASTRUCTURE_RATE_LIMITED`: wait for `Retry-After`; this limiter is process-local and is not the
  daily ranking quota.
- `BALLOT_ISSUANCE_UNAVAILABLE`: inspect structured logs by request ID and safe error code. Never log
  the visitor cookie or token.

Railway deployment, migrations, backup/restore, scheduled jobs, alerts, and incident procedures are
completed and tested in Milestone 9. This file must be expanded before staging approval.
