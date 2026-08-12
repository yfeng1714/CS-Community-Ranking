import { and, eq, isNull } from "drizzle-orm";

import { writeAdminAudit } from "../audit.ts";
import { requireIsoDate } from "../date.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import { rosterMemberships } from "../../db/schema/index.ts";

export type RosterStatus = "STARTER" | "BENCH" | "STAND_IN";

export async function addRosterMembership(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    endsAt?: string | null | undefined;
    playerId: bigint;
    reason: string;
    source?: string | null | undefined;
    startsAt: string;
    status: RosterStatus;
    teamId: bigint;
  },
) {
  const startsAt = requireIsoDate(input.startsAt, "Roster start");
  const endsAt = input.endsAt ? requireIsoDate(input.endsAt, "Roster end") : null;
  const reason = requireNonBlank(input.reason, "Roster change reason");

  if (endsAt && endsAt < startsAt) {
    throw new DomainError("INVALID_ROSTER_DATES", "Roster end cannot precede its start");
  }

  return database.transaction(async (transaction) => {
    if (!endsAt) {
      const [current] = await transaction
        .select({ id: rosterMemberships.id })
        .from(rosterMemberships)
        .where(
          and(eq(rosterMemberships.playerId, input.playerId), isNull(rosterMemberships.endsAt)),
        )
        .for("update")
        .limit(1);

      if (current) {
        throw new DomainError(
          "CURRENT_ROSTER_CONFLICT",
          "Player already has a current roster membership; close it explicitly first",
        );
      }
    }

    const [membership] = await transaction
      .insert(rosterMemberships)
      .values({
        endsAt,
        playerId: input.playerId,
        source: input.source?.trim() || null,
        startsAt,
        status: input.status,
        teamId: input.teamId,
      })
      .returning();
    const created = requireDomainValue(
      membership,
      "ROSTER_CREATE_FAILED",
      "Roster insertion returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "ADD_ROSTER_MEMBERSHIP",
      actorAdminUserId: input.actorAdminUserId,
      after: created,
      reason,
      targetId: created.id.toString(),
      targetType: "ROSTER_MEMBERSHIP",
    });

    return created;
  });
}

export async function endRosterMembership(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    endsAt: string;
    membershipId: bigint;
    reason: string;
  },
) {
  const endsAt = requireIsoDate(input.endsAt, "Roster end");
  const reason = requireNonBlank(input.reason, "Roster change reason");

  return database.transaction(async (transaction) => {
    const [before] = await transaction
      .select()
      .from(rosterMemberships)
      .where(eq(rosterMemberships.id, input.membershipId))
      .for("update")
      .limit(1);
    const current = requireDomainValue(
      before,
      "ROSTER_MEMBERSHIP_NOT_FOUND",
      `Roster membership ${input.membershipId} not found`,
    );

    if (current.endsAt) {
      throw new DomainError("ROSTER_ALREADY_CLOSED", "Roster membership is already closed");
    }

    if (endsAt < current.startsAt) {
      throw new DomainError("INVALID_ROSTER_DATES", "Roster end cannot precede its start");
    }

    const [after] = await transaction
      .update(rosterMemberships)
      .set({ endsAt })
      .where(eq(rosterMemberships.id, current.id))
      .returning();
    const updated = requireDomainValue(
      after,
      "ROSTER_UPDATE_FAILED",
      "Roster update returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "END_ROSTER_MEMBERSHIP",
      actorAdminUserId: input.actorAdminUserId,
      after: updated,
      before: current,
      reason,
      targetId: current.id.toString(),
      targetType: "ROSTER_MEMBERSHIP",
    });

    return updated;
  });
}
