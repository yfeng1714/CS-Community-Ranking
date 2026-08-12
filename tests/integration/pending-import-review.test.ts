import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { PendingImportReviewService } from "@/domain/admin/pending-imports";
import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;
let actorAdminUserId: bigint;
let syncRunId: bigint;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
  const [actor] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "integration-only", username: "import-reviewer" })
    .returning({ id: schema.adminUsers.id });
  const [run] = await database
    .insert(schema.syncRuns)
    .values({
      finishedAt: new Date("2040-01-01T00:10:00.000Z"),
      jobName: "team-import",
      provider: "TEST",
      startedAt: new Date("2040-01-01T00:00:00.000Z"),
      status: "SUCCEEDED",
    })
    .returning({ id: schema.syncRuns.id });
  if (!actor || !run) throw new Error("Failed to create pending-import fixtures");
  actorAdminUserId = actor.id;
  syncRunId = run.id;
});

afterAll(async () => {
  await dropTestDatabase(testDatabase);
});

describe("Milestone 6 pending-import review", () => {
  it("revalidates and applies a proposal with its review and mutation audits atomically", async () => {
    const [pending] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "TEAM",
        proposedData: {
          action: "team.create",
          expectedState: null,
          input: { name: "Imported Team", slug: "imported-team" },
          version: 1,
        },
        syncRunId,
        targetExternalKey: "imported-team",
      })
      .returning();
    if (!pending) throw new Error("Failed to create proposal");

    const reviewed = await new PendingImportReviewService(database).review({
      actorAdminUserId,
      decision: "APPROVE",
      pendingChangeId: pending.id,
      reason: "Verified the provider proposal against current state",
    });
    expect(reviewed.status).toBe("APPROVED");
    await expect(
      database.select().from(schema.teams).where(eq(schema.teams.slug, "imported-team")),
    ).resolves.toHaveLength(1);
    const audit = await database
      .select({ action: schema.adminAuditLogs.action })
      .from(schema.adminAuditLogs)
      .where(eq(schema.adminAuditLogs.actorAdminUserId, actorAdminUserId));
    expect(audit.map((row) => row.action)).toEqual(
      expect.arrayContaining(["CREATE_TEAM", "APPROVE_PENDING_IMPORT"]),
    );
  });

  it("refuses conflicts and stale expected state without changing review status", async () => {
    const [conflicted] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "TEAM",
        conflictCodes: ["AMBIGUOUS_IDENTITY"],
        proposedData: {
          action: "team.create",
          expectedState: null,
          input: { name: "Conflict Team", slug: "conflict-team" },
          version: 1,
        },
        syncRunId,
        targetExternalKey: "conflict-team",
      })
      .returning();
    const [stale] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "TEAM",
        proposedData: {
          action: "team.create",
          expectedState: null,
          input: { name: "Replacement", slug: "imported-team" },
          version: 1,
        },
        syncRunId,
        targetExternalKey: "imported-team",
      })
      .returning();
    if (!conflicted || !stale) throw new Error("Failed to create guarded proposals");
    const service = new PendingImportReviewService(database);

    await expect(
      service.review({
        actorAdminUserId,
        decision: "APPROVE",
        pendingChangeId: conflicted.id,
        reason: "Attempt conflicted proposal",
      }),
    ).rejects.toMatchObject({ code: "PENDING_IMPORT_HAS_CONFLICTS" });
    await expect(
      service.review({
        actorAdminUserId,
        decision: "APPROVE",
        pendingChangeId: stale.id,
        reason: "Attempt stale proposal",
      }),
    ).rejects.toMatchObject({ code: "PENDING_IMPORT_STATE_CHANGED" });

    const statuses = await database
      .select({ status: schema.pendingImportChanges.status })
      .from(schema.pendingImportChanges)
      .where(eq(schema.pendingImportChanges.syncRunId, syncRunId));
    expect(statuses.filter((row) => row.status === "PENDING")).toHaveLength(2);
  });
});
