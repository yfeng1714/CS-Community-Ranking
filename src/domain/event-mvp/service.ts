import { and, count, eq, isNull, sql } from "drizzle-orm";

import {
  anonymousVisitors,
  eventMvpCandidates,
  eventMvpContests,
  eventMvpVotes,
  players,
  rosterMemberships,
  teams,
} from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { dateInTimeZone } from "../ballots/date.ts";
import { DomainError, requireDomainValue } from "../error.ts";
import { toPublicMetric } from "../public/presentation.ts";
import type { RiskAssessment } from "../../security/risk-monitor.ts";
import { CURRENT_EVENT_MVP_SLUG } from "./bundle.ts";

export interface EventMvpPlayer {
  country: string | null;
  eventRating: number;
  maps: number | null;
  nickname: string;
  photoUrl: string | null;
  rank: number;
  slug: string;
  sourceRank: number;
  team: string | null;
  teamLogoUrl: string | null;
  teamShortName: string | null;
  votes: number;
}

export interface EventMvpBoard {
  contest: {
    capturedAt: string;
    endsAt: string;
    name: string;
    navLabel: string;
    slug: string;
    sourceUrl: string;
    startsAt: string;
    status: "ACTIVE" | "FROZEN";
  } | null;
  players: EventMvpPlayer[];
  todayVoteSlug: string | null;
}

export function compareEventMvpPlayers(
  left: Pick<EventMvpPlayer, "eventRating" | "nickname" | "votes">,
  right: Pick<EventMvpPlayer, "eventRating" | "nickname" | "votes">,
): number {
  if (left.votes !== right.votes) return right.votes - left.votes;
  if (left.eventRating !== right.eventRating) return right.eventRating - left.eventRating;
  return left.nickname.localeCompare(right.nickname, "en");
}

export class EventMvpService {
  constructor(
    private readonly database: AppDatabase,
    private readonly options: { riskEnforcementMode: "enforce" | "observe"; timeZone: string },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getBoard(visitorId: bigint | null, slug = CURRENT_EVENT_MVP_SLUG): Promise<EventMvpBoard> {
    const [contest] = await this.database
      .select()
      .from(eventMvpContests)
      .where(eq(eventMvpContests.slug, slug))
      .limit(1);
    if (!contest) {
      return { contest: null, players: [], todayVoteSlug: null };
    }

    const rows = await this.database
      .select({
        country: players.countryCode,
        eventRating: eventMvpCandidates.eventRating,
        maps: eventMvpCandidates.maps,
        nickname: players.nickname,
        photoUrl: players.photoPath,
        playerId: players.id,
        slug: players.slug,
        sourceRank: eventMvpCandidates.sourceRank,
        team: teams.name,
        teamLogoUrl: teams.logoPath,
        teamShortName: teams.shortName,
      })
      .from(eventMvpCandidates)
      .innerJoin(players, eq(players.id, eventMvpCandidates.playerId))
      .leftJoin(
        rosterMemberships,
        and(eq(rosterMemberships.playerId, players.id), isNull(rosterMemberships.endsAt)),
      )
      .leftJoin(teams, eq(teams.id, rosterMemberships.teamId))
      .where(eq(eventMvpCandidates.contestId, contest.id));

    const voteRows = await this.database
      .select({
        playerId: eventMvpVotes.playerId,
        votes: count(),
      })
      .from(eventMvpVotes)
      .where(and(eq(eventMvpVotes.contestId, contest.id), eq(eventMvpVotes.status, "VALID")))
      .groupBy(eventMvpVotes.playerId);
    const votesByPlayer = new Map(
      voteRows.map((row) => {
        const votes = Number(row.votes);
        if (!Number.isSafeInteger(votes) || votes < 0) {
          throw new DomainError("EVENT_MVP_VOTE_COUNT_INVALID", "Event MVP vote count is invalid");
        }
        return [row.playerId, votes] as const;
      }),
    );

    const sorted = [...rows]
      .map((row) => ({
        country: row.country,
        eventRating: requireDomainValue(
          toPublicMetric(row.eventRating),
          "EVENT_MVP_RATING_INVALID",
          `Event rating for ${row.slug} is not numeric`,
        ),
        maps: row.maps,
        nickname: row.nickname,
        photoUrl: row.photoUrl,
        slug: row.slug,
        sourceRank: row.sourceRank,
        team: row.team,
        teamLogoUrl: row.teamLogoUrl,
        teamShortName: row.teamShortName,
        votes: votesByPlayer.get(row.playerId) ?? 0,
      }))
      .sort(compareEventMvpPlayers);

    let previousVotes: number | undefined;
    let rank = 0;
    const playersOnBoard: EventMvpPlayer[] = sorted.map((row, index) => {
      if (previousVotes === undefined || row.votes !== previousVotes) {
        rank = index + 1;
        previousVotes = row.votes;
      }
      return {
        country: row.country,
        eventRating: row.eventRating,
        maps: row.maps,
        nickname: row.nickname,
        photoUrl: row.photoUrl,
        rank,
        slug: row.slug,
        sourceRank: row.sourceRank,
        team: row.team,
        teamLogoUrl: row.teamLogoUrl,
        teamShortName: row.teamShortName,
        votes: row.votes,
      };
    });

    let todayVoteSlug: string | null = null;
    if (visitorId) {
      const usageDate = dateInTimeZone(this.now(), this.options.timeZone);
      const [vote] = await this.database
        .select({ slug: players.slug })
        .from(eventMvpVotes)
        .innerJoin(players, eq(players.id, eventMvpVotes.playerId))
        .where(
          and(
            eq(eventMvpVotes.contestId, contest.id),
            eq(eventMvpVotes.visitorId, visitorId),
            eq(eventMvpVotes.usageDate, usageDate),
            sql`${eventMvpVotes.status} <> 'REVOKED'`,
          ),
        )
        .limit(1);
      todayVoteSlug = vote?.slug ?? null;
    }

    return {
      contest: {
        capturedAt: contest.capturedAt.toISOString(),
        endsAt: contest.endsAt,
        name: contest.name,
        navLabel: contest.navLabel,
        slug: contest.slug,
        sourceUrl: contest.sourceUrl,
        startsAt: contest.startsAt,
        status: contest.status === "FROZEN" ? "FROZEN" : "ACTIVE",
      },
      players: playersOnBoard,
      todayVoteSlug,
    };
  }

  async vote(input: {
    ipRiskKey: Buffer | null;
    playerSlug: string;
    reasonCodes: RiskAssessment["reasonCodes"];
    visitorId: bigint;
  }): Promise<{ alreadyVoted: boolean; playerSlug: string; status: "SUSPICIOUS" | "VALID" }> {
    return this.database.transaction(async (transaction) => {
      const [contest] = await transaction
        .select()
        .from(eventMvpContests)
        .where(
          and(
            eq(eventMvpContests.slug, CURRENT_EVENT_MVP_SLUG),
            eq(eventMvpContests.status, "ACTIVE"),
          ),
        )
        .for("share")
        .limit(1);
      if (!contest) {
        throw new DomainError("EVENT_MVP_NOT_ACTIVE", "The current event contest is not open");
      }

      const [visitor] = await transaction
        .select()
        .from(anonymousVisitors)
        .where(eq(anonymousVisitors.id, input.visitorId))
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

      const [candidate] = await transaction
        .select({ playerId: eventMvpCandidates.playerId, slug: players.slug })
        .from(eventMvpCandidates)
        .innerJoin(players, eq(players.id, eventMvpCandidates.playerId))
        .where(
          and(eq(eventMvpCandidates.contestId, contest.id), eq(players.slug, input.playerSlug)),
        )
        .limit(1);
      if (!candidate) {
        throw new DomainError(
          "EVENT_MVP_PLAYER_NOT_FOUND",
          "That player is not on the event ballot",
        );
      }

      const usageDate = dateInTimeZone(this.now(), this.options.timeZone);
      const [existing] = await transaction
        .select({ playerId: eventMvpVotes.playerId, status: eventMvpVotes.status })
        .from(eventMvpVotes)
        .where(
          and(
            eq(eventMvpVotes.contestId, contest.id),
            eq(eventMvpVotes.visitorId, input.visitorId),
            eq(eventMvpVotes.usageDate, usageDate),
            sql`${eventMvpVotes.status} <> 'REVOKED'`,
          ),
        )
        .for("update")
        .limit(1);
      if (existing) {
        if (existing.playerId === candidate.playerId) {
          return {
            alreadyVoted: true,
            playerSlug: candidate.slug,
            status: existing.status === "SUSPICIOUS" ? "SUSPICIOUS" : "VALID",
          };
        }
        throw new DomainError("EVENT_MVP_ALREADY_VOTED", "This visitor already voted today");
      }

      const status =
        this.options.riskEnforcementMode === "enforce" &&
        (lockedVisitor.riskState === "SUSPICIOUS" || input.reasonCodes.length > 0)
          ? "SUSPICIOUS"
          : "VALID";

      await transaction.insert(eventMvpVotes).values({
        contestId: contest.id,
        ipRiskKey: input.ipRiskKey,
        playerId: candidate.playerId,
        riskReasonCodes: input.reasonCodes,
        status,
        usageDate,
        visitorId: input.visitorId,
      });

      return { alreadyVoted: false, playerSlug: candidate.slug, status };
    });
  }
}
