import { and, asc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { transitionEdition } from "@/domain/editions/service";
import { checkScoreIntegrity } from "@/domain/votes/integrity";
import { VoteModerationService } from "@/domain/votes/moderation";
import { VoteResolutionService } from "@/domain/votes/resolution";

import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

const RESOLUTION_TIME = new Date("2042-06-15T08:00:00.000Z");
const USAGE_DATE = "2042-06-15";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;
let actorAdminUserId: bigint;
let editionId: bigint;
let playerIds: [bigint, bigint, bigint];
let visitorSequence = 0;

type Eligibility = "ELIGIBLE" | "SUSPICIOUS" | "THROTTLED";

async function createBallot(input: {
  dailyOrdinal?: number;
  eligibility?: Eligibility;
  expiresAt?: Date;
  leftPlayerId?: bigint;
  usageDate?: string;
}) {
  visitorSequence += 1;
  const [visitor] = await database
    .insert(schema.anonymousVisitors)
    .values({ tokenHash: Buffer.from(`m4-visitor-${visitorSequence}`) })
    .returning();
  if (!visitor) {
    throw new Error("Failed to create M4 visitor fixture");
  }

  const dailyOrdinal = input.dailyOrdinal ?? 1;
  const usageDate = input.usageDate ?? USAGE_DATE;
  await database.insert(schema.visitorDailyUsage).values({
    ballotsIssued: dailyOrdinal,
    editionId,
    usageDate,
    visitorId: visitor.id,
  });

  const [player1Id, player2Id] = playerIds;
  const leftPlayerId = input.leftPlayerId ?? player1Id;
  const rightPlayerId = leftPlayerId === player1Id ? player2Id : player1Id;
  const [ballot] = await database
    .insert(schema.ballots)
    .values({
      dailyOrdinal,
      editionId,
      expiresAt: input.expiresAt ?? new Date("2042-06-15T08:30:00.000Z"),
      issuedAt: new Date("2042-06-15T07:59:00.000Z"),
      leftPlayerId,
      player1Id,
      player2Id,
      rankingEligibility: input.eligibility ?? "ELIGIBLE",
      rightPlayerId,
      usageDate,
      visitorId: visitor.id,
    })
    .returning();
  if (!ballot) {
    throw new Error("Failed to create M4 Ballot fixture");
  }

  return { ballot, visitor };
}

async function getPairAggregate() {
  const [player1Id, player2Id] = playerIds;
  const [aggregate] = await database
    .select()
    .from(schema.pairAggregates)
    .where(
      and(
        eq(schema.pairAggregates.editionId, editionId),
        eq(schema.pairAggregates.player1Id, player1Id),
        eq(schema.pairAggregates.player2Id, player2Id),
      ),
    );
  return aggregate;
}

async function getRankings() {
  return database
    .select()
    .from(schema.playerRankings)
    .where(eq(schema.playerRankings.editionId, editionId))
    .orderBy(asc(schema.playerRankings.playerId));
}

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });

  const [actor] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "disabled-integration-hash", username: "m4-moderator" })
    .returning();
  const [edition] = await database
    .insert(schema.editions)
    .values({
      code: "2042",
      endsAt: new Date("2043-01-01T00:00:00.000Z"),
      fullWeightBallotsPerDay: 50,
      name: "2042 Vote Resolution Test Edition",
      startsAt: new Date("2042-01-01T00:00:00.000Z"),
      status: "ACTIVE",
    })
    .returning();
  if (!actor || !edition) {
    throw new Error("Failed to create M4 Edition fixture");
  }
  actorAdminUserId = actor.id;
  editionId = edition.id;

  const createdPlayerIds: bigint[] = [];
  for (let index = 1; index <= 3; index += 1) {
    const [player] = await database
      .insert(schema.players)
      .values({
        nickname: `M4 Player ${index}`,
        professionalStatus: "ACTIVE",
        slug: `m4-player-${index}`,
      })
      .returning();
    if (!player) {
      throw new Error("Failed to create M4 player fixture");
    }
    createdPlayerIds.push(player.id);
    await database.insert(schema.playerRankings).values({
      editionId,
      playerId: player.id,
    });
  }
  if (createdPlayerIds.length !== 3) {
    throw new Error("M4 fixture requires three players");
  }
  playerIds = createdPlayerIds as [bigint, bigint, bigint];
});

afterAll(async () => {
  await dropTestDatabase(testDatabase);
});

describe.sequential("Milestone 4 Vote resolution", () => {
  it("turns one hundred concurrent same-choice resolves into exactly one ranking effect", async () => {
    const { ballot, visitor } = await createBallot({});
    const service = new VoteResolutionService(database, () => new Date(RESOLUTION_TIME));
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        service.resolve({
          choice: "LEFT",
          publicBallotId: ballot.publicId,
          visitorId: visitor.id,
        }),
      ),
    );

    expect(results.filter((result) => !result.resolution.alreadyResolved)).toHaveLength(1);
    expect(results.filter((result) => result.resolution.alreadyResolved)).toHaveLength(99);
    expect(results.every((result) => result.resolution.voteStatus === "VALID")).toBe(true);

    const storedVotes = await database
      .select()
      .from(schema.votes)
      .where(eq(schema.votes.ballotId, ballot.id));
    expect(storedVotes).toHaveLength(1);
    const rankings = await getRankings();
    expect(rankings.map(({ losses, score, wins }) => ({ losses, score, wins }))).toEqual([
      { losses: 0n, score: 1, wins: 1n },
      { losses: 1n, score: -1, wins: 0n },
      { losses: 0n, score: 0, wins: 0n },
    ]);
    expect(await getPairAggregate()).toMatchObject({
      countedPlayer1Wins: 1n,
      countedPlayer2Wins: 0n,
      observedPlayer1Choices: 1n,
      observedPlayer2Choices: 0n,
    });

    const [usage] = await database
      .select()
      .from(schema.visitorDailyUsage)
      .where(eq(schema.visitorDailyUsage.visitorId, visitor.id));
    expect(usage).toMatchObject({ validResolved: 1, validSkips: 0 });
  }, 90_000);

  it("rejects a conflicting retry and rolls the whole transaction back on injected failures", async () => {
    const conflict = await createBallot({});
    const service = new VoteResolutionService(database, () => new Date(RESOLUTION_TIME));
    const settled = await Promise.allSettled([
      service.resolve({
        choice: "LEFT",
        publicBallotId: conflict.ballot.publicId,
        visitorId: conflict.visitor.id,
      }),
      service.resolve({
        choice: "RIGHT",
        publicBallotId: conflict.ballot.publicId,
        visitorId: conflict.visitor.id,
      }),
    ]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: {
        code: "BALLOT_ALREADY_RESOLVED",
        details: { originalChoice: expect.stringMatching(/LEFT|RIGHT/) },
      },
    });

    const afterInsertFailure = await createBallot({});
    const insertFailureService = new VoteResolutionService(
      database,
      () => new Date(RESOLUTION_TIME),
      {
        afterVoteInsert: () => {
          throw new Error("forced failure after Vote insert");
        },
      },
    );
    await expect(
      insertFailureService.resolve({
        choice: "LEFT",
        publicBallotId: afterInsertFailure.ballot.publicId,
        visitorId: afterInsertFailure.visitor.id,
      }),
    ).rejects.toThrow("forced failure after Vote insert");
    expect(
      await database
        .select()
        .from(schema.votes)
        .where(eq(schema.votes.ballotId, afterInsertFailure.ballot.id)),
    ).toHaveLength(0);

    const afterRankingFailure = await createBallot({});
    const beforeRankings = await getRankings();
    const beforeAggregate = await getPairAggregate();
    const rankingFailureService = new VoteResolutionService(
      database,
      () => new Date(RESOLUTION_TIME),
      {
        afterFirstRankingUpdate: () => {
          throw new Error("forced failure after first ranking update");
        },
      },
    );
    await expect(
      rankingFailureService.resolve({
        choice: "RIGHT",
        publicBallotId: afterRankingFailure.ballot.publicId,
        visitorId: afterRankingFailure.visitor.id,
      }),
    ).rejects.toThrow("forced failure after first ranking update");
    expect(await getRankings()).toEqual(beforeRankings);
    expect(await getPairAggregate()).toEqual(beforeAggregate);
    const [stillOpen] = await database
      .select({ status: schema.ballots.status })
      .from(schema.ballots)
      .where(eq(schema.ballots.id, afterRankingFailure.ballot.id));
    expect(stillOpen?.status).toBe("OPEN");
  });

  it("stores Ballot 51 and suspicious Votes without changing ranking or counted totals", async () => {
    const beforeRankings = await getRankings();
    const beforeAggregate = await getPairAggregate();
    const throttled = await createBallot({ dailyOrdinal: 51, eligibility: "THROTTLED" });
    const suspicious = await createBallot({ eligibility: "SUSPICIOUS" });
    const service = new VoteResolutionService(database, () => new Date(RESOLUTION_TIME));

    const throttledResult = await service.resolve({
      choice: "RIGHT",
      publicBallotId: throttled.ballot.publicId,
      visitorId: throttled.visitor.id,
    });
    const suspiciousResult = await service.resolve({
      choice: "SKIP",
      publicBallotId: suspicious.ballot.publicId,
      visitorId: suspicious.visitor.id,
    });

    expect(throttledResult.resolution).toMatchObject({ counted: false, voteStatus: "THROTTLED" });
    expect(suspiciousResult.resolution).toMatchObject({ counted: false, voteStatus: "SUSPICIOUS" });
    expect(await getRankings()).toEqual(beforeRankings);
    expect(await getPairAggregate()).toMatchObject({
      countedPlayer1Wins: beforeAggregate?.countedPlayer1Wins,
      countedPlayer2Wins: beforeAggregate?.countedPlayer2Wins,
      countedSkips: beforeAggregate?.countedSkips,
      observedPlayer2Choices: (beforeAggregate?.observedPlayer2Choices ?? 0n) + 1n,
      observedSkips: (beforeAggregate?.observedSkips ?? 0n) + 1n,
    });

    const usageRows = await database
      .select()
      .from(schema.visitorDailyUsage)
      .where(
        and(
          eq(schema.visitorDailyUsage.editionId, editionId),
          eq(schema.visitorDailyUsage.usageDate, USAGE_DATE),
        ),
      );
    expect(usageRows.find((row) => row.visitorId === throttled.visitor.id)).toMatchObject({
      throttledResolved: 1,
    });
    expect(usageRows.find((row) => row.visitorId === suspicious.visitor.id)).toMatchObject({
      suspiciousResolved: 1,
    });
  });

  it("counts and idempotently replays Skip, then revokes it without erasing observed activity", async () => {
    const beforeRankings = await getRankings();
    const beforeAggregate = await getPairAggregate();
    const fixture = await createBallot({ usageDate: "2042-06-16" });
    const service = new VoteResolutionService(database, () => new Date(RESOLUTION_TIME));
    const first = await service.resolve({
      choice: "SKIP",
      publicBallotId: fixture.ballot.publicId,
      visitorId: fixture.visitor.id,
    });
    const repeated = await service.resolve({
      choice: "SKIP",
      publicBallotId: fixture.ballot.publicId,
      visitorId: fixture.visitor.id,
    });
    expect(first.resolution.alreadyResolved).toBe(false);
    expect(repeated.resolution.alreadyResolved).toBe(true);

    const afterSkipRankings = await getRankings();
    expect(afterSkipRankings[0]?.skips).toBe((beforeRankings[0]?.skips ?? 0n) + 1n);
    expect(afterSkipRankings[1]?.skips).toBe((beforeRankings[1]?.skips ?? 0n) + 1n);
    const afterSkipAggregate = await getPairAggregate();
    expect(afterSkipAggregate?.countedSkips).toBe((beforeAggregate?.countedSkips ?? 0n) + 1n);
    expect(afterSkipAggregate?.observedSkips).toBe((beforeAggregate?.observedSkips ?? 0n) + 1n);

    const [vote] = await database
      .select()
      .from(schema.votes)
      .where(eq(schema.votes.ballotId, fixture.ballot.id));
    if (!vote) {
      throw new Error("Expected a persisted Skip Vote");
    }
    await new VoteModerationService(database, () => new Date(RESOLUTION_TIME)).revoke({
      actorAdminUserId,
      reason: "Integration test rollback of a counted Skip",
      voteId: vote.id,
    });

    expect(await getRankings()).toEqual(beforeRankings);
    expect(await getPairAggregate()).toMatchObject({
      countedSkips: beforeAggregate?.countedSkips,
      observedSkips: (beforeAggregate?.observedSkips ?? 0n) + 1n,
    });
    await expect(
      new VoteModerationService(database).revoke({
        actorAdminUserId,
        reason: "A second revocation must not change counters",
        voteId: vote.id,
      }),
    ).rejects.toMatchObject({ code: "VOTE_NOT_REVOCABLE" });
    expect(
      await database
        .select()
        .from(schema.moderationAuditLogs)
        .where(eq(schema.moderationAuditLogs.voteId, vote.id)),
    ).toHaveLength(1);
  });

  it("revokes a decision, preserves zero-sum integrity, and blocks unresolved effects after freeze", async () => {
    const fixture = await createBallot({ leftPlayerId: playerIds[1] });
    const service = new VoteResolutionService(database, () => new Date(RESOLUTION_TIME));
    await service.resolve({
      choice: "LEFT",
      publicBallotId: fixture.ballot.publicId,
      visitorId: fixture.visitor.id,
    });
    const [vote] = await database
      .select()
      .from(schema.votes)
      .where(eq(schema.votes.ballotId, fixture.ballot.id));
    if (!vote) {
      throw new Error("Expected a persisted decision Vote");
    }
    await new VoteModerationService(database).revoke({
      actorAdminUserId,
      reason: "Restore the counted decision in the integration scenario",
      voteId: vote.id,
    });

    const integrity = await checkScoreIntegrity(database, editionId);
    expect(integrity).toMatchObject({ healthy: true, scoreSum: "0", violations: [] });

    const stillReadable = await service.resolve({
      choice: "LEFT",
      publicBallotId: fixture.ballot.publicId,
      visitorId: fixture.visitor.id,
    });
    expect(stillReadable.resolution).toMatchObject({
      alreadyResolved: true,
      counted: false,
      voteStatus: "REVOKED",
    });

    const unresolved = await createBallot({});
    await transitionEdition(database, {
      actorAdminUserId,
      editionId,
      reason: "Freeze after the M4 transaction scenarios",
      status: "FROZEN",
    });
    await expect(
      service.resolve({
        choice: "RIGHT",
        publicBallotId: unresolved.ballot.publicId,
        visitorId: unresolved.visitor.id,
      }),
    ).rejects.toMatchObject({ code: "EDITION_NOT_ACTIVE" });
    expect(
      await database
        .select()
        .from(schema.votes)
        .where(eq(schema.votes.ballotId, unresolved.ballot.id)),
    ).toHaveLength(0);
  });
});
