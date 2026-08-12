import { and, asc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { BallotIssuanceService } from "@/domain/ballots/service";
import { ActivePoolCache } from "@/domain/pool/active-pool-cache";
import { CandidatePoolService } from "@/domain/pool/service";
import { hashVisitorToken, VisitorIdentityService } from "@/domain/visitors/service";

import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;
let editionId: bigint;
let playerIds: bigint[];
let activePool: CandidatePoolService;

async function seedBallotFixture(): Promise<void> {
  const [actor] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "disabled-test-hash", username: "ballot-test-actor" })
    .returning();
  const [edition] = await database
    .insert(schema.editions)
    .values({
      ballotTtlMinutes: 1,
      code: "2040",
      endsAt: new Date("2041-01-01T00:00:00Z"),
      fullWeightBallotsPerDay: 1,
      name: "2040 Ballot Test Edition",
      startsAt: new Date("2040-01-01T00:00:00Z"),
      status: "ACTIVE",
    })
    .returning();
  if (!actor || !edition) {
    throw new Error("Failed to create Ballot integration fixture");
  }
  editionId = edition.id;

  playerIds = [];
  for (let index = 1; index <= 3; index += 1) {
    const [player] = await database
      .insert(schema.players)
      .values({
        nickname: `Ballot Player ${index}`,
        professionalStatus: "ACTIVE",
        slug: `ballot-player-${index}`,
      })
      .returning();
    if (!player) {
      throw new Error("Failed to create Ballot player fixture");
    }
    playerIds.push(player.id);
    await database.insert(schema.poolPlayerEntries).values({
      admissionReason: "Ballot integration fixture",
      admissionType: "SPECIAL",
      approvedBy: actor.id,
      editionId,
      playerId: player.id,
    });
  }

  activePool = new CandidatePoolService(database, new ActivePoolCache(60_000));
}

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
  await seedBallotFixture();
});

afterAll(async () => {
  await dropTestDatabase(testDatabase);
});

describe("Milestone 3 visitor identity and Ballot issuance", () => {
  it("creates and looks up a visitor using only the HMAC token digest", async () => {
    const service = new VisitorIdentityService(
      database,
      "integration-visitor-pepper-that-is-at-least-32-bytes",
    );
    const created = await service.resolve(undefined);

    expect(created.tokenToSet).toBeDefined();
    expect(created.created).toBe(true);
    const token = created.tokenToSet ?? "";
    const [stored] = await database
      .select({ tokenHash: schema.anonymousVisitors.tokenHash })
      .from(schema.anonymousVisitors)
      .where(eq(schema.anonymousVisitors.id, created.id));
    expect(stored?.tokenHash).toEqual(
      hashVisitorToken(token, "integration-visitor-pepper-that-is-at-least-32-bytes"),
    );
    expect(stored?.tokenHash.toString("utf8")).not.toContain(token);

    await expect(service.resolve(token)).resolves.toMatchObject({ created: false, id: created.id });
  });

  it("serializes concurrent next requests, preserves the ordinal, expires without refund, and rejects stale Pool IDs", async () => {
    const [visitor] = await database
      .insert(schema.anonymousVisitors)
      .values({ tokenHash: Buffer.from("ballot-concurrency-visitor") })
      .returning();
    if (!visitor) {
      throw new Error("Failed to create concurrent visitor fixture");
    }

    let currentTime = new Date("2026-08-10T16:30:00.000Z");
    const service = new BallotIssuanceService(
      database,
      activePool,
      { riskEnforcementMode: "observe", timeZone: "Asia/Shanghai" },
      () => new Date(currentTime),
      () => 0,
    );
    const concurrent = await Promise.all(
      Array.from({ length: 12 }, () => service.issue(visitor.id)),
    );

    expect(new Set(concurrent.map((result) => result.ballot.id))).toHaveLength(1);
    expect(new Set(concurrent.map((result) => result.ballot.dailyOrdinal))).toEqual(new Set([1]));
    expect(concurrent.filter((result) => !result.reusedOpenBallot)).toHaveLength(1);
    expect(concurrent[0]?.ballot.left.slug).not.toBe(concurrent[0]?.ballot.right.slug);

    const firstBallotId = concurrent[0]?.ballot.id;
    const repeated = await service.issue(visitor.id);
    expect(repeated.ballot.id).toBe(firstBallotId);
    expect(repeated.ballot.dailyOrdinal).toBe(1);
    expect(repeated.reusedOpenBallot).toBe(true);

    const [firstUsage] = await database
      .select()
      .from(schema.visitorDailyUsage)
      .where(
        and(
          eq(schema.visitorDailyUsage.visitorId, visitor.id),
          eq(schema.visitorDailyUsage.editionId, editionId),
        ),
      );
    expect(firstUsage).toMatchObject({ ballotsIssued: 1, usageDate: "2026-08-11" });

    currentTime = new Date("2026-08-10T16:32:00.000Z");
    const second = await service.issue(visitor.id);
    expect(second.ballot.id).not.toBe(firstBallotId);
    expect(second.ballot.dailyOrdinal).toBe(2);
    expect(second.ballot.rankingMode).toBe("THROTTLED");

    const disabledPlayerId = playerIds[0];
    if (disabledPlayerId === undefined) {
      throw new Error("Missing player fixture");
    }
    await database
      .update(schema.poolPlayerEntries)
      .set({
        pairingDisabledAt: currentTime,
        pairingDisabledReason: "Exercise stale-cache revalidation",
        pairingEnabled: false,
      })
      .where(
        and(
          eq(schema.poolPlayerEntries.editionId, editionId),
          eq(schema.poolPlayerEntries.playerId, disabledPlayerId),
        ),
      );

    currentTime = new Date("2026-08-10T16:34:00.000Z");
    const third = await service.issue(visitor.id);
    expect(third.ballot.dailyOrdinal).toBe(3);
    expect([third.ballot.left.slug, third.ballot.right.slug]).not.toContain("ballot-player-1");

    const ballotRows = await database
      .select({ dailyOrdinal: schema.ballots.dailyOrdinal, status: schema.ballots.status })
      .from(schema.ballots)
      .where(eq(schema.ballots.visitorId, visitor.id))
      .orderBy(asc(schema.ballots.dailyOrdinal));
    expect(ballotRows).toEqual([
      { dailyOrdinal: 1, status: "EXPIRED" },
      { dailyOrdinal: 2, status: "EXPIRED" },
      { dailyOrdinal: 3, status: "OPEN" },
    ]);

    const [finalUsage] = await database
      .select({ ballotsIssued: schema.visitorDailyUsage.ballotsIssued })
      .from(schema.visitorDailyUsage)
      .where(
        and(
          eq(schema.visitorDailyUsage.visitorId, visitor.id),
          eq(schema.visitorDailyUsage.editionId, editionId),
          eq(schema.visitorDailyUsage.usageDate, "2026-08-11"),
        ),
      );
    expect(finalUsage?.ballotsIssued).toBe(3);
  });

  it("records risk reasons in observe mode and enforces them only when configured", async () => {
    const [observeVisitor, enforceVisitor] = await database
      .insert(schema.anonymousVisitors)
      .values([
        { tokenHash: Buffer.from("observe-risk-visitor") },
        { tokenHash: Buffer.from("enforce-risk-visitor") },
      ])
      .returning();
    if (!observeVisitor || !enforceVisitor) throw new Error("Missing risk visitors");
    const risk = {
      ipRiskKey: Buffer.alloc(32, 7),
      reasonCodes: ["EXTREME_REQUEST_VELOCITY" as const],
    };
    const now = () => new Date("2026-08-12T10:00:00Z");
    const observe = new BallotIssuanceService(
      database,
      activePool,
      { riskEnforcementMode: "observe", timeZone: "Asia/Shanghai" },
      now,
    );
    const enforce = new BallotIssuanceService(
      database,
      activePool,
      { riskEnforcementMode: "enforce", timeZone: "Asia/Shanghai" },
      now,
    );

    await observe.issue(observeVisitor.id, risk);
    await enforce.issue(enforceVisitor.id, risk);
    const rows = await database
      .select({
        eligibility: schema.ballots.rankingEligibility,
        reasons: schema.ballots.riskReasonCodes,
      })
      .from(schema.ballots)
      .where(
        and(eq(schema.ballots.editionId, editionId), eq(schema.ballots.usageDate, "2026-08-12")),
      );
    expect(rows).toEqual(
      expect.arrayContaining([
        { eligibility: "ELIGIBLE", reasons: ["EXTREME_REQUEST_VELOCITY"] },
        { eligibility: "SUSPICIOUS", reasons: ["EXTREME_REQUEST_VELOCITY"] },
      ]),
    );
  });
});
