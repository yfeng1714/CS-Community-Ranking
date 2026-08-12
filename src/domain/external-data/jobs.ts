import { eq } from "drizzle-orm";

import { playerExternalIdentities } from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { requireIsoDate } from "../date.ts";
import { DomainError } from "../error.ts";
import { sourceChecksum } from "./checksum.ts";
import { fetchProviderText } from "./fetch.ts";
import {
  HLTV_PLAYER_STATS_PARSER_VERSION,
  HLTV_RANKING_PARSER_VERSION,
  parseHltvPlayerStatsHtml,
  parseHltvTeamRankingHtml,
} from "./providers/hltv.ts";
import { parseValveVrsMarkdown, VALVE_VRS_PARSER_VERSION } from "./providers/valve-vrs.ts";
import { writeHltvPlayerStats, writeRankingSourceSnapshot } from "./snapshots.ts";
import { runRecordedSync } from "./sync-runs.ts";

export async function syncValveVrs(
  database: AppDatabase,
  input: { body?: string; capturedAt?: Date; sourceUrl: string },
) {
  const capturedAt = input.capturedAt ?? new Date();
  return runRecordedSync(database, {
    jobName: "sync-vrs",
    metadata: { parserVersion: VALVE_VRS_PARSER_VERSION, sourceUrl: input.sourceUrl },
    provider: "VALVE_VRS",
    operation: async () => {
      const body =
        input.body ??
        (await fetchProviderText({
          allowedContentTypes: ["text/plain", "text/markdown"],
          url: input.sourceUrl,
          userAgent: "CS-Community-Ranking/0.1 VRS importer",
        }));
      const snapshot = parseValveVrsMarkdown(body, input.sourceUrl);
      const stored = await writeRankingSourceSnapshot(database, {
        capturedAt,
        checksum: sourceChecksum(body),
        parserVersion: VALVE_VRS_PARSER_VERSION,
        provider: "VALVE_VRS",
        snapshot,
      });
      return {
        metadata: { snapshotId: stored.id.toString() },
        recordsChanged: stored.changed ? 1 : 0,
        recordsSeen: snapshot.teams.length,
        sourceFreshnessAt: new Date(snapshot.publishedAt),
        value: { snapshotId: stored.id, teams: snapshot.teams.length },
      };
    },
  });
}

export async function syncHltvRanking(
  database: AppDatabase,
  input: {
    body?: string;
    capturedAt?: Date;
    publishedAt: Date;
    sourceUrl: string;
    userAgent: string;
    delayMs?: number;
  },
) {
  if (Number.isNaN(input.publishedAt.getTime())) {
    throw new DomainError("HLTV_RANKING_DATE_INVALID", "HLTV ranking publication date is invalid");
  }
  const capturedAt = input.capturedAt ?? new Date();
  return runRecordedSync(database, {
    jobName: "sync-hltv-ranking",
    metadata: { parserVersion: HLTV_RANKING_PARSER_VERSION, sourceUrl: input.sourceUrl },
    provider: "HLTV",
    operation: async () => {
      const body =
        input.body ??
        (await fetchProviderText({
          allowedContentTypes: ["text/html"],
          ...(input.delayMs === undefined ? {} : { delayMs: input.delayMs }),
          url: input.sourceUrl,
          userAgent: input.userAgent,
        }));
      const snapshot = parseHltvTeamRankingHtml(body, input.sourceUrl, input.publishedAt);
      const stored = await writeRankingSourceSnapshot(database, {
        capturedAt,
        checksum: sourceChecksum(body),
        parserVersion: HLTV_RANKING_PARSER_VERSION,
        provider: "HLTV",
        snapshot,
      });
      return {
        metadata: { snapshotId: stored.id.toString() },
        recordsChanged: stored.changed ? 1 : 0,
        recordsSeen: snapshot.teams.length,
        sourceFreshnessAt: input.publishedAt,
        value: { snapshotId: stored.id, teams: snapshot.teams.length },
      };
    },
  });
}

export async function syncHltvPlayerStats(
  database: AppDatabase,
  input: {
    capturedAt?: Date;
    delayMs: number;
    periodEnd: string;
    periodStart: string;
    userAgent: string;
  },
) {
  const periodStart = requireIsoDate(input.periodStart, "HLTV stats period start");
  const periodEnd = requireIsoDate(input.periodEnd, "HLTV stats period end");
  if (periodEnd < periodStart) {
    throw new DomainError(
      "HLTV_STATS_PERIOD_INVALID",
      "HLTV stats period end cannot precede start",
    );
  }
  const capturedAt = input.capturedAt ?? new Date();
  const identities = await database
    .select()
    .from(playerExternalIdentities)
    .where(eq(playerExternalIdentities.provider, "HLTV"));
  if (identities.length === 0)
    throw new DomainError("HLTV_IDENTITIES_MISSING", "No HLTV player identities are configured");
  return runRecordedSync(database, {
    jobName: "sync-hltv-player-stats",
    metadata: { parserVersion: HLTV_PLAYER_STATS_PARSER_VERSION },
    provider: "HLTV",
    operation: async () => {
      let changedPlayers = 0;
      let snapshotsWritten = 0;
      const failures: string[] = [];
      for (const identity of identities) {
        const slug = identity.externalSlug ?? identity.externalId;
        const sourceUrl = `https://www.hltv.org/stats/players/${encodeURIComponent(identity.externalId)}/${encodeURIComponent(slug)}?startDate=${input.periodStart}&endDate=${input.periodEnd}`;
        try {
          const body = await fetchProviderText({
            allowedContentTypes: ["text/html"],
            delayMs: input.delayMs,
            maxAttempts: 2,
            url: sourceUrl,
            userAgent: input.userAgent,
          });
          const stats = parseHltvPlayerStatsHtml({
            body,
            externalId: identity.externalId,
            periodEnd: input.periodEnd,
            periodStart: input.periodStart,
            sourceUrl,
          });
          const written = await writeHltvPlayerStats(database, {
            capturedAt,
            playerId: identity.playerId,
            stats,
          });
          snapshotsWritten += written;
          if (written > 0) changedPlayers += 1;
        } catch (error) {
          failures.push(
            `${identity.externalId}: ${error instanceof Error ? error.message : "unknown failure"}`,
          );
        }
      }
      if (failures.length === identities.length)
        throw new DomainError("HLTV_STATS_SYNC_FAILED", failures.join("; "));
      return {
        metadata: { failures, snapshotsWritten },
        recordsChanged: changedPlayers,
        recordsSeen: identities.length,
        sourceFreshnessAt: capturedAt,
        status: failures.length ? ("PARTIAL" as const) : ("SUCCEEDED" as const),
        value: { changedPlayers, failures, snapshotsWritten },
      };
    },
  });
}
