import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { generateDailyKpiReport } from "@/domain/analytics/kpi";
import { runIntegrityCheck } from "@/domain/integrity/check";
import { expireOpenBallots, runRetentionCleanup } from "@/domain/maintenance/jobs";
import { PublicRiskMonitor } from "@/security/risk-monitor";

import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;
let editionId: bigint;
let visitorId: bigint;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
  const [admin] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "disabled", username: "m8-admin" })
    .returning();
  const [edition] = await database
    .insert(schema.editions)
    .values({
      code: "2050",
      endsAt: new Date("2051-01-01Z"),
      name: "M8 Edition",
      startsAt: new Date("2050-01-01Z"),
      status: "ACTIVE",
    })
    .returning();
  const [visitor] = await database
    .insert(schema.anonymousVisitors)
    .values({ tokenHash: Buffer.alloc(32, 1) })
    .returning();
  if (!admin || !edition || !visitor) throw new Error("M8 fixture failed");
  editionId = edition.id;
  visitorId = visitor.id;

  for (const index of [1, 2]) {
    const [player] = await database
      .insert(schema.players)
      .values({ nickname: `M8 ${index}`, professionalStatus: "ACTIVE", slug: `m8-${index}` })
      .returning();
    if (!player) throw new Error("M8 player failed");
    await database.insert(schema.poolPlayerEntries).values({
      admissionReason: "M8 fixture",
      admissionType: "SPECIAL",
      approvedBy: admin.id,
      editionId,
      playerId: player.id,
    });
    await database.insert(schema.playerRankings).values({ editionId, playerId: player.id });
  }
});

afterAll(async () => dropTestDatabase(testDatabase));

describe("Milestone 8 hardening", () => {
  it("generates a first-party KPI report", async () => {
    const occurredAt = new Date("2026-08-12T03:00:00Z");
    await database.insert(schema.visitorDailyUsage).values({
      ballotsIssued: 1,
      editionId,
      usageDate: "2026-08-11",
      visitorId,
    });
    await database.insert(schema.visitorDailyUsage).values({
      ballotsIssued: 2,
      editionId,
      usageDate: "2026-08-12",
      validResolved: 1,
      visitorId,
    });
    await database.insert(schema.productEvents).values([
      { editionId, eventType: "NEXT_CLICK", occurredAt, visitorId },
      { editionId, eventType: "RANKING_VIEW", occurredAt, visitorId },
    ]);
    await database.insert(schema.apiRequestMetrics).values({
      latencyMs: 42,
      occurredAt,
      route: "/api/v1/ballots/{public_id}/resolve",
      statusCode: 200,
      visitorId,
    });

    const report = await generateDailyKpiReport(database, {
      date: "2026-08-12",
      editionCode: "2050",
      timeZone: "Asia/Shanghai",
    });
    expect(report.ballot).toMatchObject({
      averageIssuedPerVisitor: 2,
      repeatVisitors: 1,
      visitors: 1,
    });
    expect(report.api).toMatchObject({ p50LatencyMs: 42, requests: 1 });
  });

  it("detects same-day cookie churn through only the daily network HMAC", async () => {
    const monitor = new PublicRiskMonitor(
      database,
      {
        clientIpMode: "railway",
        impossibleFlowThreshold: 5,
        invalidOwnershipThreshold: 10,
        ipHmacSecret: "m8-integration-ip-secret-with-at-least-32-characters",
        maximumKeys: 100,
        newVisitorThreshold: 1,
        publicApiLimit: 300,
        replayMismatchThreshold: 10,
        requestVelocityThreshold: 120,
        timeZone: "Asia/Shanghai",
        trustProxyHeaders: true,
      },
      () => new Date("2026-08-12T03:00:00Z"),
    );
    const headers = new Headers({ "x-real-ip": "192.0.2.40" });
    const [secondVisitor] = await database
      .insert(schema.anonymousVisitors)
      .values({ tokenHash: Buffer.alloc(32, 9) })
      .returning();
    if (!secondVisitor) throw new Error("Second M8 visitor missing");

    const normal = await monitor.assess({
      inspection: monitor.inspect(headers),
      route: "/api/v1/ballots/next",
      visitorCreated: true,
      visitorId,
    });
    const churn = await monitor.assess({
      inspection: monitor.inspect(headers),
      route: "/api/v1/ballots/next",
      visitorCreated: true,
      visitorId: secondVisitor.id,
    });
    expect(normal.reasonCodes).toEqual([]);
    expect(churn.reasonCodes).toContain("ABNORMAL_NEW_VISITOR_CHURN");
    expect(churn.ipRiskKey).toHaveLength(32);
  });

  it("expires Ballots and removes only retained pseudonymous/analytics data", async () => {
    const players = await database.select({ id: schema.players.id }).from(schema.players);
    const first = players[0]?.id;
    const second = players[1]?.id;
    if (!first || !second) throw new Error("M8 fixture players missing");
    const old = new Date("2025-01-01T00:00:00Z");
    const [ballot] = await database
      .insert(schema.ballots)
      .values({
        dailyOrdinal: 1,
        editionId,
        expiresAt: new Date("2026-01-01T00:01:00Z"),
        issuedAt: old,
        issuedIpRiskKey: Buffer.alloc(32, 2),
        leftPlayerId: first,
        player1Id: first < second ? first : second,
        player2Id: first < second ? second : first,
        rankingEligibility: "ELIGIBLE",
        rightPlayerId: second,
        usageDate: "2025-01-01",
        visitorId,
      })
      .returning();
    if (!ballot) throw new Error("M8 Ballot missing");
    expect(await expireOpenBallots(database, { now: new Date("2026-01-02Z") })).toEqual({
      expired: 1,
    });
    await database.insert(schema.riskObservations).values({
      ipRiskKey: Buffer.alloc(32, 3),
      occurredAt: old,
      reasonCode: "NEW_VISITOR",
      route: "/api/v1/ballots/next",
      visitorId,
    });
    const cleanup = await runRetentionCleanup(database, {
      ipRiskKeyRetentionDays: 90,
      now: new Date("2026-08-12Z"),
      productEventRetentionDays: 90,
    });
    expect(cleanup.ballotRiskKeysNulled).toBe(1);
    const [preserved] = await database
      .select({ key: schema.ballots.issuedIpRiskKey, status: schema.ballots.status })
      .from(schema.ballots)
      .where(eq(schema.ballots.id, ballot.id));
    expect(preserved).toEqual({ key: null, status: "EXPIRED" });
  });

  it("reports a healthy cross-table integrity state", async () => {
    const report = await runIntegrityCheck(database, { editionCode: "2050" });
    expect(report.healthy).toBe(true);
    expect(report.violations).toEqual([]);
  });
});
