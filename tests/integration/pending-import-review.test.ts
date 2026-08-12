import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { PendingImportReviewService } from "@/domain/admin/pending-imports";
import { toAuditRecord } from "@/domain/audit";
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

  it("revalidates updates by internal ID and compares JSON state independent of key order", async () => {
    const [team] = await database
      .insert(schema.teams)
      .values({ name: "Stateful Team", slug: "stateful-team" })
      .returning();
    if (!team) throw new Error("Failed to create state fixture");
    const expected = Object.fromEntries(Object.entries(toAuditRecord(team)!).reverse());
    const [pending] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "TEAM",
        proposedData: {
          action: "team.update",
          expectedState: expected,
          input: { name: "Stateful Team Updated", teamId: team.id.toString() },
          version: 1,
        },
        syncRunId,
        targetExternalKey: "provider-id-that-is-not-the-team-slug",
      })
      .returning();
    if (!pending) throw new Error("Failed to create state proposal");

    const invalidateAllActivePlayerIds = vi.fn();
    await new PendingImportReviewService(database, { invalidateAllActivePlayerIds }).review({
      actorAdminUserId,
      decision: "APPROVE",
      pendingChangeId: pending.id,
      reason: "Verified the unchanged target by its internal identity",
    });
    const [updated] = await database
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, team.id));
    expect(updated?.name).toBe("Stateful Team Updated");
    expect(invalidateAllActivePlayerIds).not.toHaveBeenCalled();
  });

  it("applies automatic Pool evidence under its real category and invalidates runtime cache", async () => {
    const [edition] = await database
      .insert(schema.editions)
      .values({
        code: "2040",
        endsAt: new Date("2041-01-01T00:00:00.000Z"),
        name: "2040 Import Pool",
        startsAt: new Date("2040-01-01T00:00:00.000Z"),
        status: "DRAFT",
      })
      .returning();
    const [team] = await database
      .insert(schema.teams)
      .values({ name: "Imported Pool Team", slug: "imported-pool-team" })
      .returning();
    if (!edition || !team) throw new Error("Failed to create Pool proposal fixtures");
    for (let index = 1; index <= 5; index += 1) {
      const [player] = await database
        .insert(schema.players)
        .values({
          nickname: `import-starter-${index}`,
          professionalStatus: "ACTIVE",
          slug: `import-starter-${index}`,
        })
        .returning();
      if (!player) throw new Error("Failed to create Pool starter fixture");
      await database.insert(schema.rosterMemberships).values({
        playerId: player.id,
        startsAt: "2040-01-01",
        status: "STARTER",
        teamId: team.id,
      });
    }
    const [pending] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "POOL_TEAM",
        editionId: edition.id,
        proposedData: {
          action: "pool.admit-team",
          expectedState: null,
          input: {
            editionId: edition.id.toString(),
            evidence: { editionYear: 2040, eventResults: [], hltvRank: 12 },
            teamId: team.id.toString(),
          },
          version: 1,
        },
        syncRunId,
        targetExternalKey: "provider-team-42",
      })
      .returning();
    if (!pending) throw new Error("Failed to create Pool proposal");
    const invalidateActivePlayerIds = vi.fn();

    await new PendingImportReviewService(database, { invalidateActivePlayerIds }).review({
      actorAdminUserId,
      decision: "APPROVE",
      pendingChangeId: pending.id,
      reason: "Approve provider evidence after manual review",
    });
    const [entry] = await database
      .select()
      .from(schema.poolTeamEntries)
      .where(eq(schema.poolTeamEntries.teamId, team.id));
    expect(entry?.admissionType).toBe("CORE");
    expect(invalidateActivePlayerIds).toHaveBeenCalledWith(edition.id);
  });

  it("clears runtime Pool snapshots after an imported Player eligibility update", async () => {
    const [player] = await database
      .insert(schema.players)
      .values({
        nickname: "Eligibility Player",
        professionalStatus: "ACTIVE",
        slug: "eligibility-player",
      })
      .returning();
    if (!player) throw new Error("Failed to create Player eligibility fixture");
    const [pending] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "PLAYER",
        proposedData: {
          action: "player.update",
          expectedState: toAuditRecord(player),
          input: { playerId: player.id.toString(), professionalStatus: "INACTIVE" },
          version: 1,
        },
        syncRunId,
        targetExternalKey: "provider-player-eligibility",
      })
      .returning();
    if (!pending) throw new Error("Failed to create Player eligibility proposal");
    const invalidateAllActivePlayerIds = vi.fn();

    await new PendingImportReviewService(database, { invalidateAllActivePlayerIds }).review({
      actorAdminUserId,
      decision: "APPROVE",
      pendingChangeId: pending.id,
      reason: "Confirm provider evidence that changes pairing eligibility",
    });
    expect(invalidateAllActivePlayerIds).toHaveBeenCalledOnce();
  });

  it("rejects unsupported or non-exact proposal envelopes", async () => {
    const [pending] = await database
      .insert(schema.pendingImportChanges)
      .values({
        changeType: "EVENT",
        proposedData: {
          action: "edition.create",
          expectedState: null,
          input: {},
          unexpected: true,
          version: 1,
        },
        syncRunId,
        targetExternalKey: "unsupported-edition",
      })
      .returning();
    if (!pending) throw new Error("Failed to create unsupported proposal");

    await expect(
      new PendingImportReviewService(database).review({
        actorAdminUserId,
        decision: "APPROVE",
        pendingChangeId: pending.id,
        reason: "Attempt an unsupported proposal action",
      }),
    ).rejects.toHaveProperty("name", "ZodError");
    const [unchanged] = await database
      .select({ status: schema.pendingImportChanges.status })
      .from(schema.pendingImportChanges)
      .where(eq(schema.pendingImportChanges.id, pending.id));
    expect(unchanged?.status).toBe("PENDING");
  });
});
