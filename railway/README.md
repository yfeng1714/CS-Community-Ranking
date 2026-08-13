# Railway service configuration

Each Railway service is connected to this repository and assigned its matching config path under
**Settings → Config-as-code**. Every service builds the same production Docker image.

| Service | Config path | Shanghai cadence |
| --- | --- | --- |
| `web` | `/railway/web.json` | continuous, one Singapore replica |
| `expire-ballots` | `/railway/job-expire-ballots.json` | every 10 minutes |
| `integrity-check` | `/railway/job-integrity-check.json` | daily 02:30 |
| `retention-cleanup` | `/railway/job-retention-cleanup.json` | daily 02:50 |
| `snapshot-ranking` | `/railway/job-snapshot-ranking.json` | daily 03:10 |
| `report-kpi` | `/railway/report-kpi.json` | daily 03:30 |
| `sync-vrs` | `/railway/job-sync-vrs.json` | Monday 04:00 |

Railway cron expressions are UTC. Scheduled commands are short-lived and must exit. Do not add a
cron schedule to `web`; do not add a web health check to one-shot services.

All services reference the private PostgreSQL `DATABASE_URL`. Web additionally owns the complete
validated application environment. Job services receive the smallest relevant subset; secrets are
Railway variables and never committed. `RISK_ENFORCEMENT_MODE` remains `observe` in staging.

The web pre-deploy command runs the committed migrations from the newly built image. Any non-zero
exit blocks that release before traffic switches. Never replace it with `db push` or seed staging
from the deployment path.

HLTV has no automatic M9 service: its job requires reviewed URLs/date windows and remains a manual
operator command until a low-frequency source schedule is explicitly approved. VRS weekly sync
only stores a reviewable source snapshot; it cannot change the live Pool.

Portable backup/restore is an owner operation through a Railway tunnel with PostgreSQL client tools
matching the server's major version. The web/job image intentionally does not carry database client
binaries or store backup files.
