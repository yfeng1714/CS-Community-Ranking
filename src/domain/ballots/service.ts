import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  anonymousVisitors,
  ballots,
  editions,
  players,
  poolPlayerEntries,
  rosterMemberships,
  teams,
  visitorDailyUsage,
} from "../../db/schema/index.ts";
import type { AppDatabase, AppTransaction } from "../database.ts";
import { DomainError, requireDomainValue } from "../error.ts";
import { getPublicPlayerStats } from "../public/queries.ts";
import { dateInTimeZone } from "./date.ts";
import { selectRandomPair, type RandomIndex } from "./random.ts";
import { withTransactionRetry } from "./retry.ts";
import type { RiskAssessment } from "../../security/risk-monitor.ts";

type RankingEligibility = "ELIGIBLE" | "THROTTLED" | "SUSPICIOUS";

export interface ActivePoolSource {
  getActivePlayerIds(editionId: bigint): Promise<readonly bigint[]>;
  invalidateActivePlayerIds(editionId: bigint): void;
}

export interface BallotPlayerCard {
  careerRating: number | null;
  country: string | null;
  nickname: string;
  photoUrl: string | null;
  recentMaps: number | null;
  recentRating: number | null;
  slug: string;
  statsCapturedAt: string | null;
  team: string | null;
  teamLogoUrl: string | null;
}

export interface IssuedBallotResponse {
  ballot: {
    dailyOrdinal: number;
    expiresAt: string;
    id: string;
    issuedAt: string;
    left: BallotPlayerCard;
    rankingMode: "ELIGIBLE" | "THROTTLED";
    right: BallotPlayerCard;
  };
  quota: {
    fullWeightLimit: number;
    remainingEligibleBallots: number;
  };
  reusedOpenBallot: boolean;
}

interface IssuedBallotCore {
  dailyOrdinal: number;
  editionId: bigint;
  expiresAt: Date;
  fullWeightLimit: number;
  issuedAt: Date;
  leftPlayerId: bigint;
  publicId: string;
  rankingEligibility: RankingEligibility;
  reusedOpenBallot: boolean;
  rightPlayerId: bigint;
}

interface PostgreSqlConstraintError {
  cause?: unknown;
  constraint?: unknown;
}

function findConstraint(error: unknown): string | undefined {
  let current = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    const candidate = current as PostgreSqlConstraintError;
    if (typeof candidate.constraint === "string") {
      return candidate.constraint;
    }
    current = candidate.cause;
  }

  return undefined;
}

function toCore(
  ballot: typeof ballots.$inferSelect,
  fullWeightLimit: number,
  reusedOpenBallot: boolean,
): IssuedBallotCore {
  return {
    dailyOrdinal: ballot.dailyOrdinal,
    editionId: ballot.editionId,
    expiresAt: ballot.expiresAt,
    fullWeightLimit,
    issuedAt: ballot.issuedAt,
    leftPlayerId: ballot.leftPlayerId,
    publicId: ballot.publicId,
    rankingEligibility: ballot.rankingEligibility,
    reusedOpenBallot,
    rightPlayerId: ballot.rightPlayerId,
  };
}

export class BallotIssuanceService {
  constructor(
    private readonly database: AppDatabase,
    private readonly activePool: ActivePoolSource,
    private readonly options: {
      riskEnforcementMode: "observe" | "enforce";
      timeZone: string;
    },
    private readonly now: () => Date = () => new Date(),
    private readonly randomIndex?: RandomIndex,
  ) {}

  async issue(
    visitorId: bigint,
    risk: RiskAssessment = { ipRiskKey: null, reasonCodes: [] },
  ): Promise<IssuedBallotResponse> {
    let core: IssuedBallotCore | undefined;

    for (let poolAttempt = 0; poolAttempt < 3; poolAttempt += 1) {
      const [activeEdition] = await this.database
        .select({ id: editions.id })
        .from(editions)
        .where(eq(editions.status, "ACTIVE"))
        .limit(1);
      if (!activeEdition) {
        throw new DomainError("NO_ACTIVE_EDITION", "No Edition is accepting Ballots");
      }
      const activePlayerIds = await this.activePool.getActivePlayerIds(activeEdition.id);

      try {
        core = await withTransactionRetry(() =>
          this.database.transaction((transaction) =>
            this.issueInTransaction(
              transaction,
              visitorId,
              activeEdition.id,
              activePlayerIds,
              risk,
            ),
          ),
        );
        break;
      } catch (error) {
        const retryableDomainChange =
          error instanceof DomainError &&
          (error.code === "ACTIVE_POOL_CHANGED" || error.code === "ACTIVE_EDITION_CHANGED");
        if (!retryableDomainChange || poolAttempt === 2) {
          throw error;
        }
      }
    }

    const issued = requireDomainValue(
      core,
      "BALLOT_ISSUE_FAILED",
      "Ballot issuance returned no result",
    );
    const [left, right] = await Promise.all([
      this.loadPlayerCard(issued.leftPlayerId),
      this.loadPlayerCard(issued.rightPlayerId),
    ]);
    const publicRankingMode = issued.rankingEligibility === "THROTTLED" ? "THROTTLED" : "ELIGIBLE";

    return {
      ballot: {
        dailyOrdinal: issued.dailyOrdinal,
        expiresAt: issued.expiresAt.toISOString(),
        id: issued.publicId,
        issuedAt: issued.issuedAt.toISOString(),
        left,
        rankingMode: publicRankingMode,
        right,
      },
      quota: {
        fullWeightLimit: issued.fullWeightLimit,
        remainingEligibleBallots: Math.max(issued.fullWeightLimit - issued.dailyOrdinal, 0),
      },
      reusedOpenBallot: issued.reusedOpenBallot,
    };
  }

  private async issueInTransaction(
    transaction: AppTransaction,
    visitorId: bigint,
    expectedEditionId: bigint,
    activePlayerIds: readonly bigint[],
    risk: RiskAssessment,
  ): Promise<IssuedBallotCore> {
    const now = this.now();
    const [edition] = await transaction
      .select()
      .from(editions)
      .where(and(eq(editions.id, expectedEditionId), eq(editions.status, "ACTIVE")))
      .for("share")
      .limit(1);
    if (!edition) {
      throw new DomainError("ACTIVE_EDITION_CHANGED", "The active Edition changed during issuance");
    }

    const [visitor] = await transaction
      .select()
      .from(anonymousVisitors)
      .where(eq(anonymousVisitors.id, visitorId))
      .for("update")
      .limit(1);
    const lockedVisitor = requireDomainValue(
      visitor,
      "VISITOR_NOT_FOUND",
      "Anonymous visitor does not exist",
    );
    if (lockedVisitor.disabledAt) {
      throw new DomainError("VISITOR_DISABLED", "Visitor access is disabled");
    }

    const [openBallot] = await transaction
      .select()
      .from(ballots)
      .where(
        and(
          eq(ballots.visitorId, visitorId),
          eq(ballots.editionId, edition.id),
          eq(ballots.status, "OPEN"),
        ),
      )
      .for("update")
      .limit(1);

    if (openBallot && openBallot.expiresAt > now) {
      return toCore(openBallot, edition.fullWeightBallotsPerDay, true);
    }

    if (openBallot) {
      await transaction
        .update(ballots)
        .set({ status: "EXPIRED" })
        .where(eq(ballots.id, openBallot.id));
    }

    const usageDate = dateInTimeZone(now, this.options.timeZone);
    const [usage] = await transaction
      .insert(visitorDailyUsage)
      .values({ ballotsIssued: 1, editionId: edition.id, usageDate, visitorId })
      .onConflictDoUpdate({
        target: [
          visitorDailyUsage.visitorId,
          visitorDailyUsage.editionId,
          visitorDailyUsage.usageDate,
        ],
        set: { ballotsIssued: sql`${visitorDailyUsage.ballotsIssued} + 1` },
      })
      .returning({ dailyOrdinal: visitorDailyUsage.ballotsIssued });
    const dailyOrdinal = requireDomainValue(
      usage,
      "USAGE_ORDINAL_FAILED",
      "Daily usage update returned no row",
    ).dailyOrdinal;
    const rankingEligibility: RankingEligibility =
      this.options.riskEnforcementMode === "enforce" &&
      (lockedVisitor.riskState === "SUSPICIOUS" || risk.reasonCodes.length > 0)
        ? "SUSPICIOUS"
        : dailyOrdinal <= edition.fullWeightBallotsPerDay
          ? "ELIGIBLE"
          : "THROTTLED";

    const pair = selectRandomPair(activePlayerIds, this.randomIndex);
    const selectedEntries = await transaction
      .select({ playerId: poolPlayerEntries.playerId })
      .from(poolPlayerEntries)
      .innerJoin(players, eq(players.id, poolPlayerEntries.playerId))
      .where(
        and(
          eq(poolPlayerEntries.editionId, edition.id),
          eq(poolPlayerEntries.pairingEnabled, true),
          eq(players.professionalStatus, "ACTIVE"),
          inArray(poolPlayerEntries.playerId, [pair.player1Id, pair.player2Id]),
        ),
      )
      .for("share");
    if (selectedEntries.length !== 2) {
      this.activePool.invalidateActivePlayerIds(edition.id);
      throw new DomainError("ACTIVE_POOL_CHANGED", "Active Pool changed during Ballot issuance");
    }

    const values = {
      dailyOrdinal,
      editionId: edition.id,
      expiresAt: new Date(now.getTime() + edition.ballotTtlMinutes * 60_000),
      issuedAt: now,
      issuedIpRiskKey: risk.ipRiskKey,
      leftPlayerId: pair.leftPlayerId,
      player1Id: pair.player1Id,
      player2Id: pair.player2Id,
      rankingEligibility,
      riskReasonCodes: risk.reasonCodes,
      rightPlayerId: pair.rightPlayerId,
      usageDate,
      visitorId,
    } as const;

    try {
      const [created] = await transaction.transaction((savepoint) =>
        savepoint.insert(ballots).values(values).returning(),
      );
      return toCore(
        requireDomainValue(created, "BALLOT_CREATE_FAILED", "Ballot insertion returned no row"),
        edition.fullWeightBallotsPerDay,
        false,
      );
    } catch (error) {
      if (findConstraint(error) !== "ballot_one_open_per_visitor_edition") {
        throw error;
      }

      await transaction
        .update(visitorDailyUsage)
        .set({ ballotsIssued: sql`${visitorDailyUsage.ballotsIssued} - 1` })
        .where(
          and(
            eq(visitorDailyUsage.visitorId, visitorId),
            eq(visitorDailyUsage.editionId, edition.id),
            eq(visitorDailyUsage.usageDate, usageDate),
          ),
        );
      const [winner] = await transaction
        .select()
        .from(ballots)
        .where(
          and(
            eq(ballots.visitorId, visitorId),
            eq(ballots.editionId, edition.id),
            eq(ballots.status, "OPEN"),
          ),
        )
        .for("update")
        .limit(1);
      return toCore(
        requireDomainValue(
          winner,
          "BALLOT_CONFLICT_RECOVERY_FAILED",
          "Open Ballot conflict had no winning row",
        ),
        edition.fullWeightBallotsPerDay,
        true,
      );
    }
  }

  private async loadPlayerCard(playerId: bigint): Promise<BallotPlayerCard> {
    const [[player], stats] = await Promise.all([
      this.database
        .select({
          country: players.countryCode,
          nickname: players.nickname,
          photoUrl: players.photoPath,
          slug: players.slug,
          team: teams.name,
          teamLogoUrl: teams.logoPath,
        })
        .from(players)
        .leftJoin(
          rosterMemberships,
          and(eq(rosterMemberships.playerId, players.id), isNull(rosterMemberships.endsAt)),
        )
        .leftJoin(teams, eq(teams.id, rosterMemberships.teamId))
        .where(eq(players.id, playerId))
        .limit(1),
      getPublicPlayerStats(this.database, playerId),
    ]);
    const found = requireDomainValue(
      player,
      "BALLOT_PLAYER_NOT_FOUND",
      "Ballot references a missing player",
    );

    return {
      careerRating: stats.careerRating,
      country: found.country,
      nickname: found.nickname,
      photoUrl: found.photoUrl,
      recentMaps: stats.recentMaps,
      recentRating: stats.recentRating,
      slug: found.slug,
      statsCapturedAt: stats.statsCapturedAt,
      team: found.team,
      teamLogoUrl: found.teamLogoUrl,
    };
  }
}
