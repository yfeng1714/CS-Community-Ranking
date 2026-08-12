import { eq } from "drizzle-orm";

import { syncRuns } from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { requireDomainValue, requireNonBlank } from "../error.ts";

export interface SyncResult<T> {
  metadata?: Record<string, unknown>;
  recordsChanged: number;
  recordsSeen: number;
  sourceFreshnessAt?: Date | null;
  status?: "PARTIAL" | "SUCCEEDED";
  value: T;
}

function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown sync failure";
  return message.replace(/\s+/g, " ").slice(0, 1_000);
}

export async function runRecordedSync<T>(
  database: AppDatabase,
  input: {
    jobName: string;
    metadata?: Record<string, unknown>;
    operation: (runId: bigint) => Promise<SyncResult<T>>;
    provider: string;
    startedAt?: Date;
  },
): Promise<T> {
  const [created] = await database
    .insert(syncRuns)
    .values({
      jobName: requireNonBlank(input.jobName, "sync job name"),
      metadata: input.metadata ?? {},
      provider: requireNonBlank(input.provider, "sync provider"),
      startedAt: input.startedAt ?? new Date(),
      status: "RUNNING",
    })
    .returning();
  const run = requireDomainValue(created, "SYNC_RUN_CREATE_FAILED", "Sync run insertion failed");

  try {
    const result = await input.operation(run.id);
    await database
      .update(syncRuns)
      .set({
        finishedAt: new Date(),
        metadata: { ...run.metadata, ...result.metadata },
        recordsChanged: result.recordsChanged,
        recordsSeen: result.recordsSeen,
        sourceFreshnessAt: result.sourceFreshnessAt ?? null,
        status: result.status ?? "SUCCEEDED",
      })
      .where(eq(syncRuns.id, run.id));
    return result.value;
  } catch (error) {
    await database
      .update(syncRuns)
      .set({ errorSummary: errorSummary(error), finishedAt: new Date(), status: "FAILED" })
      .where(eq(syncRuns.id, run.id));
    throw error;
  }
}
