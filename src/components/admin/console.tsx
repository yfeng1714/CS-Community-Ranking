import type { AdminConsoleData } from "@/domain/admin/queries";
import type { ReactNode } from "react";

import { AdminActionForm } from "./action-form";

const reasonField = {
  label: "Reason (required for audit)",
  name: "reason",
  placeholder: "Why is this change needed?",
  required: true,
} as const;

const formatTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";

function Section({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <section className="admin-section" id={id}>
      <header>
        <div>
          <span className="eyebrow">Operations</span>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function AdminConsole({ data }: { data: AdminConsoleData }) {
  const teamOptions = data.teams.map((team) => ({ label: team.name, value: team.id }));
  const playerOptions = data.players.map((player) => ({
    label: player.nickname,
    value: player.id,
  }));
  const editionOptions = data.editions.map((edition) => ({
    label: `${edition.code} · ${edition.status}`,
    value: edition.id,
  }));

  return (
    <div className="admin-console">
      <section className="admin-dashboard" id="overview">
        <div className="admin-dashboard__intro">
          <span className="eyebrow">Milestone 6</span>
          <h1>Control room</h1>
          <p>
            Every successful change below is attributed, reasoned, and committed with its audit
            record.
          </p>
        </div>
        <div className="admin-metrics">
          <article>
            <span>Active Edition</span>
            <strong>{data.dashboard.activeEdition?.code ?? "None"}</strong>
          </article>
          <article>
            <span>Pool</span>
            <strong>{data.dashboard.poolPlayers} players</strong>
            <small>{data.dashboard.poolTeams} teams</small>
          </article>
          <article data-state={data.dashboard.integrity?.healthy === false ? "warning" : "healthy"}>
            <span>Score integrity</span>
            <strong>
              {data.dashboard.integrity
                ? data.dashboard.integrity.healthy
                  ? "Healthy"
                  : "Needs review"
                : "No active Edition"}
            </strong>
            <small>{data.dashboard.integrity?.violations.join(", ") || "No violations"}</small>
          </article>
          <article>
            <span>Pending imports</span>
            <strong>{data.dashboard.pendingChanges}</strong>
            <small>
              {data.dashboard.lastSync
                ? `${data.dashboard.lastSync.status} · ${formatTime(data.dashboard.lastSync.finishedAt)}`
                : "No sync runs yet"}
            </small>
          </article>
        </div>
      </section>

      <Section
        description="Create and retire records without deleting history."
        id="people"
        title="Teams, players & rosters"
      >
        <div className="admin-form-grid">
          <div className="admin-card">
            <h3>Create team</h3>
            <AdminActionForm
              action="team.create"
              submitLabel="Create team"
              fields={[
                { label: "Slug", name: "slug", placeholder: "team-name", required: true },
                { label: "Name", name: "name", required: true },
                { label: "Short name", name: "shortName" },
                { label: "Country code", name: "countryCode" },
                reasonField,
              ]}
            />
          </div>
          <div className="admin-card">
            <h3>Create player</h3>
            <AdminActionForm
              action="player.create"
              submitLabel="Create player"
              fields={[
                { label: "Slug", name: "slug", placeholder: "nickname", required: true },
                { label: "Nickname", name: "nickname", required: true },
                { label: "Real name", name: "realName" },
                { label: "Country code", name: "countryCode" },
                {
                  defaultValue: "ACTIVE",
                  label: "Professional status",
                  name: "professionalStatus",
                  type: "select",
                  options: [
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" },
                    { label: "Retired", value: "RETIRED" },
                  ],
                },
                reasonField,
              ]}
            />
          </div>
          <div className="admin-card">
            <h3>Add roster membership</h3>
            <AdminActionForm
              action="roster.add"
              submitLabel="Add membership"
              fields={[
                {
                  label: "Player",
                  name: "playerId",
                  required: true,
                  type: "select",
                  options: playerOptions,
                },
                {
                  label: "Team",
                  name: "teamId",
                  required: true,
                  type: "select",
                  options: teamOptions,
                },
                {
                  defaultValue: "STARTER",
                  label: "Role",
                  name: "status",
                  type: "select",
                  options: [
                    { label: "Starter", value: "STARTER" },
                    { label: "Bench", value: "BENCH" },
                    { label: "Stand-in", value: "STAND_IN" },
                  ],
                },
                { label: "Starts", name: "startsAt", required: true, type: "date" },
                { label: "Source", name: "source" },
                reasonField,
              ]}
            />
          </div>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((team) => (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>{team.slug}</td>
                  <td>
                    <span className="admin-status">{team.active ? "Active" : "Inactive"}</span>
                  </td>
                  <td>
                    <AdminActionForm
                      compact
                      action="team.update"
                      submitLabel={team.active ? "Mark inactive" : "Reactivate"}
                      hidden={{ active: !team.active, teamId: team.id }}
                      fields={[reasonField]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Change status</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((player) => (
                <tr key={player.id}>
                  <td>{player.nickname}</td>
                  <td>{player.slug}</td>
                  <td>{player.professionalStatus}</td>
                  <td>
                    <AdminActionForm
                      compact
                      action="player.update"
                      submitLabel="Update"
                      hidden={{ playerId: player.id }}
                      fields={[
                        {
                          defaultValue: player.professionalStatus,
                          label: "New status",
                          name: "professionalStatus",
                          type: "select",
                          options: [
                            { label: "Active", value: "ACTIVE" },
                            { label: "Inactive", value: "INACTIVE" },
                            { label: "Retired", value: "RETIRED" },
                          ],
                        },
                        reasonField,
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Team / role</th>
                <th>Dates</th>
                <th>Close</th>
              </tr>
            </thead>
            <tbody>
              {data.rosters.map((roster) => (
                <tr key={roster.id}>
                  <td>{roster.playerName}</td>
                  <td>
                    {roster.teamName} · {roster.status}
                  </td>
                  <td>
                    {roster.startsAt} → {roster.endsAt ?? "current"}
                  </td>
                  <td>
                    {!roster.endsAt && (
                      <AdminActionForm
                        compact
                        action="roster.end"
                        submitLabel="End membership"
                        hidden={{ membershipId: roster.id }}
                        fields={[
                          { label: "End date", name: "endsAt", required: true, type: "date" },
                          reasonField,
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        description="Edition transitions are forward-only; confirmed whitelist decisions remain historical fact."
        id="editions"
        title="Editions & event whitelist"
      >
        <div className="admin-form-grid">
          <div className="admin-card">
            <h3>Create Edition</h3>
            <AdminActionForm
              action="edition.create"
              submitLabel="Create draft"
              fields={[
                { label: "Code", name: "code", placeholder: "2027", required: true },
                { label: "Name", name: "name", required: true },
                { label: "Starts", name: "startsAt", required: true, type: "datetime-local" },
                { label: "Ends", name: "endsAt", required: true, type: "datetime-local" },
                {
                  defaultValue: "50",
                  label: "Full-weight ballots/day",
                  name: "fullWeightBallotsPerDay",
                  required: true,
                  type: "number",
                },
                {
                  defaultValue: "30",
                  label: "Ballot TTL (minutes)",
                  name: "ballotTtlMinutes",
                  required: true,
                  type: "number",
                },
                reasonField,
              ]}
            />
          </div>
          <div className="admin-card">
            <h3>Create event</h3>
            <AdminActionForm
              action="event.create"
              submitLabel="Create event"
              fields={[
                { label: "Slug", name: "slug", required: true },
                { label: "Name", name: "name", required: true },
                { label: "Starts", name: "startsAt", required: true, type: "date" },
                { label: "Ends", name: "endsAt", required: true, type: "date" },
                reasonField,
              ]}
            />
          </div>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Edition</th>
                <th>Window</th>
                <th>Status</th>
                <th>Next transition</th>
              </tr>
            </thead>
            <tbody>
              {data.editions.map((edition) => {
                const next = {
                  DRAFT: "ACTIVE",
                  ACTIVE: "FROZEN",
                  FROZEN: "ARCHIVED",
                  ARCHIVED: null,
                }[edition.status];
                return (
                  <tr key={edition.id}>
                    <td>
                      {edition.code} · {edition.name}
                    </td>
                    <td>
                      {formatTime(edition.startsAt)} → {formatTime(edition.endsAt)}
                    </td>
                    <td>{edition.status}</td>
                    <td>
                      {next && (
                        <AdminActionForm
                          compact
                          action="edition.transition"
                          submitLabel={`Move to ${next}`}
                          hidden={{ editionId: edition.id, status: next }}
                          fields={[reasonField]}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Dates</th>
                <th>Whitelist</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.id}>
                  <td>
                    {event.name}
                    <small>{event.slug}</small>
                  </td>
                  <td>
                    {event.startsAt} → {event.endsAt}
                  </td>
                  <td>
                    {event.isT1Whitelisted
                      ? `${event.whitelistReason}${event.isMajor ? " · Major" : ""}`
                      : "Not confirmed"}
                  </td>
                  <td>
                    {!event.isT1Whitelisted && (
                      <AdminActionForm
                        compact
                        action="event.whitelist"
                        submitLabel="Confirm decision"
                        hidden={{ eventId: event.id }}
                        fields={[
                          {
                            defaultValue: "true",
                            label: "Include in T1",
                            name: "enabled",
                            type: "checkbox",
                          },
                          {
                            defaultValue: "MANUAL",
                            label: "Reason type",
                            name: "whitelistReason",
                            type: "select",
                            options: [
                              { label: "Manual", value: "MANUAL" },
                              { label: "HLTV highlight", value: "HLTV_HIGHLIGHT" },
                              { label: "Major", value: "MAJOR" },
                              { label: "None (exclude)", value: "NONE" },
                            ],
                          },
                          { label: "Major", name: "isMajor", type: "checkbox" },
                          { label: "Note", name: "note" },
                          reasonField,
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        description="Admissions are append-only. Pairing can be disabled immediately without erasing history."
        id="pool"
        title="Candidate Pool"
      >
        <div className="admin-form-grid">
          <div className="admin-card">
            <h3>Admit team + current five</h3>
            <AdminActionForm
              action="pool.admit-team"
              submitLabel="Admit team"
              fields={[
                {
                  label: "Edition",
                  name: "editionId",
                  required: true,
                  type: "select",
                  options: editionOptions,
                },
                {
                  label: "Team",
                  name: "teamId",
                  required: true,
                  type: "select",
                  options: teamOptions,
                },
                reasonField,
              ]}
            />
          </div>
          <div className="admin-card">
            <h3>Special player admission</h3>
            <AdminActionForm
              action="pool.admit-player"
              submitLabel="Admit player"
              fields={[
                {
                  label: "Edition",
                  name: "editionId",
                  required: true,
                  type: "select",
                  options: editionOptions,
                },
                {
                  label: "Player",
                  name: "playerId",
                  required: true,
                  type: "select",
                  options: playerOptions,
                },
                reasonField,
              ]}
            />
          </div>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Edition</th>
                <th>Admission</th>
                <th>Pairing</th>
              </tr>
            </thead>
            <tbody>
              {data.poolPlayers.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.playerName}</td>
                  <td>{entry.editionCode}</td>
                  <td>
                    {entry.admissionType}
                    <small>{entry.admissionReason}</small>
                  </td>
                  <td>
                    <AdminActionForm
                      compact
                      action="pool.pairing"
                      submitLabel={entry.pairingEnabled ? "Disable" : "Enable"}
                      hidden={{
                        editionId: entry.editionId,
                        enabled: !entry.pairingEnabled,
                        playerId: entry.playerId,
                      }}
                      fields={[reasonField]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        description="Approval re-locks the proposal, rejects conflicts and newer sync runs, compares expected state, then applies and audits in one transaction."
        id="imports"
        title="Pending imports"
      >
        {data.pendingImports.length === 0 ? (
          <p className="admin-empty">No import proposals yet. M7 will populate this queue.</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>State</th>
                  <th>Payload</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingImports.map((change) => (
                  <tr key={change.id}>
                    <td>
                      {change.changeType} · {change.targetExternalKey}
                      <small>{formatTime(change.createdAt)}</small>
                    </td>
                    <td>
                      {change.status}
                      {change.conflictCodes.length > 0 && (
                        <small>{change.conflictCodes.join(", ")}</small>
                      )}
                    </td>
                    <td>
                      <details>
                        <summary>Inspect JSON</summary>
                        <pre>{JSON.stringify(change.proposedData, null, 2)}</pre>
                      </details>
                    </td>
                    <td>
                      {change.status === "PENDING" && (
                        <>
                          <AdminActionForm
                            compact
                            action="pending.review"
                            submitLabel="Approve"
                            hidden={{ decision: "APPROVE", pendingChangeId: change.id }}
                            fields={[reasonField]}
                          />
                          <AdminActionForm
                            compact
                            action="pending.review"
                            submitLabel="Reject"
                            hidden={{ decision: "REJECT", pendingChangeId: change.id }}
                            fields={[reasonField]}
                          />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        description="Revocation reverses counted score effects and retains the Vote plus before/after evidence."
        id="moderation"
        title="Vote moderation"
      >
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vote</th>
                <th>Choice</th>
                <th>Status / risk</th>
                <th>Revoke</th>
              </tr>
            </thead>
            <tbody>
              {data.votes.map((vote) => (
                <tr key={vote.id}>
                  <td>
                    #{vote.id}
                    <small>{formatTime(vote.createdAt)}</small>
                  </td>
                  <td>{vote.choice}</td>
                  <td>
                    {vote.status}
                    <small>{vote.riskReasonCodes.join(", ") || "No flags"}</small>
                  </td>
                  <td>
                    {vote.status === "VALID" && (
                      <AdminActionForm
                        compact
                        action="vote.revoke"
                        submitLabel="Revoke Vote"
                        hidden={{ voteId: vote.id }}
                        fields={[reasonField]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        description="Immutable operational evidence for general changes, Pool governance, moderation, and future sync jobs."
        id="audit"
        title="Audit & sync history"
      >
        <div className="admin-audit-grid">
          <div className="admin-card">
            <h3>General audit</h3>
            {data.auditLogs.map((log) => (
              <article className="admin-log" key={log.id}>
                <strong>{log.action}</strong>
                <span>{log.target}</span>
                <p>{log.reason}</p>
                <small>
                  {log.actor} · {formatTime(log.createdAt)}
                </small>
              </article>
            ))}
          </div>
          <div className="admin-card">
            <h3>Pool change log</h3>
            {data.poolChangeLogs.map((log) => (
              <article className="admin-log" key={log.id}>
                <strong>{log.action}</strong>
                <span>
                  {log.editionCode} · {log.target}
                </span>
                <p>{log.reason}</p>
                <small>
                  {log.actor} · {formatTime(log.createdAt)}
                </small>
              </article>
            ))}
          </div>
          <div className="admin-card">
            <h3>Moderation audit</h3>
            {data.moderationLogs.map((log) => (
              <article className="admin-log" key={log.id}>
                <strong>{log.action}</strong>
                <span>Vote #{log.voteId}</span>
                <p>{log.reason}</p>
                <small>
                  {log.actor} · {formatTime(log.createdAt)}
                </small>
              </article>
            ))}
          </div>
          <div className="admin-card">
            <h3>Sync runs / parser failures</h3>
            {data.syncRuns.length === 0 ? (
              <p className="admin-empty">No sync runs yet.</p>
            ) : (
              data.syncRuns.map((run) => (
                <article className="admin-log" key={run.id}>
                  <strong>
                    {run.jobName} · {run.status}
                  </strong>
                  <span>
                    {run.provider} · {run.recordsChanged}/{run.recordsSeen} changed
                  </span>
                  {run.errorSummary && <p>{run.errorSummary}</p>}
                  <small>{formatTime(run.startedAt)}</small>
                </article>
              ))
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
