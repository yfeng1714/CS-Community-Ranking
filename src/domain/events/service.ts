import { and, eq } from "drizzle-orm";

import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import { events, eventTeamResults } from "../../db/schema/index.ts";

export type WhitelistReason = "MAJOR" | "HLTV_HIGHLIGHT" | "MANUAL" | "NONE";

function requireIsoDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new DomainError("INVALID_DATE", `${field} must use a valid YYYY-MM-DD date`);
  }
  return value;
}

export async function createEvent(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    endsAt: string;
    name: string;
    reason: string;
    slug: string;
    startsAt: string;
  },
) {
  const startsAt = requireIsoDate(input.startsAt, "Event start");
  const endsAt = requireIsoDate(input.endsAt, "Event end");
  const reason = requireNonBlank(input.reason, "Event creation reason");

  if (endsAt < startsAt) {
    throw new DomainError("INVALID_EVENT_DATES", "Event end cannot precede its start");
  }

  return database.transaction(async (transaction) => {
    const [event] = await transaction
      .insert(events)
      .values({
        endsAt,
        name: requireNonBlank(input.name, "Event name"),
        slug: requireNonBlank(input.slug, "Event slug"),
        startsAt,
      })
      .returning();
    const created = requireDomainValue(
      event,
      "EVENT_CREATE_FAILED",
      "Event insertion returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "CREATE_EVENT",
      actorAdminUserId: input.actorAdminUserId,
      after: created,
      reason,
      targetId: created.id.toString(),
      targetType: "EVENT",
    });

    return created;
  });
}

export async function setEventWhitelist(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    enabled: boolean;
    eventId: bigint;
    isMajor: boolean;
    note?: string | null | undefined;
    reason: string;
    whitelistReason: WhitelistReason;
  },
) {
  const auditReason = requireNonBlank(input.reason, "Event whitelist change reason");

  if (input.isMajor && (!input.enabled || input.whitelistReason !== "MAJOR")) {
    throw new DomainError(
      "INVALID_MAJOR_WHITELIST",
      "A confirmed Major must be enabled with the MAJOR whitelist reason",
    );
  }

  if (input.enabled && input.whitelistReason === "NONE") {
    throw new DomainError("INVALID_WHITELIST_REASON", "Enabled events require a whitelist reason");
  }

  if (!input.enabled && input.whitelistReason !== "NONE") {
    throw new DomainError("INVALID_WHITELIST_REASON", "Disabled events must use the NONE reason");
  }

  return database.transaction(async (transaction) => {
    const [before] = await transaction
      .select()
      .from(events)
      .where(eq(events.id, input.eventId))
      .for("update")
      .limit(1);
    const current = requireDomainValue(
      before,
      "EVENT_NOT_FOUND",
      `Event ${input.eventId} not found`,
    );

    if (current.isT1Whitelisted) {
      const sameDecision =
        input.enabled &&
        input.isMajor === current.isMajor &&
        input.whitelistReason === current.whitelistReason &&
        (input.note?.trim() || null) === current.whitelistNote;

      if (sameDecision) {
        return current;
      }

      throw new DomainError(
        "EVENT_WHITELIST_IMMUTABLE",
        "A confirmed T1 whitelist decision is historical fact and cannot be rewritten",
      );
    }

    const [after] = await transaction
      .update(events)
      .set({
        approvedAt: input.enabled ? new Date() : null,
        approvedBy: input.enabled ? input.actorAdminUserId : null,
        isMajor: input.isMajor,
        isT1Whitelisted: input.enabled,
        whitelistNote: input.enabled ? input.note?.trim() || null : null,
        whitelistReason: input.whitelistReason,
      })
      .where(eq(events.id, current.id))
      .returning();
    const updated = requireDomainValue(
      after,
      "EVENT_UPDATE_FAILED",
      "Event whitelist update returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "SET_EVENT_WHITELIST",
      actorAdminUserId: input.actorAdminUserId,
      after: updated,
      before: current,
      reason: auditReason,
      targetId: current.id.toString(),
      targetType: "EVENT",
    });

    return updated;
  });
}

export async function recordEventTeamResult(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    eventId: bigint;
    placementFrom: number;
    placementTo: number;
    reason: string;
    teamId: bigint;
  },
) {
  const reason = requireNonBlank(input.reason, "Event result reason");

  if (
    !Number.isInteger(input.placementFrom) ||
    !Number.isInteger(input.placementTo) ||
    input.placementFrom <= 0 ||
    input.placementTo < input.placementFrom
  ) {
    throw new DomainError("INVALID_PLACEMENT", "Placement must be a positive ordered range");
  }

  return database.transaction(async (transaction) => {
    const [before] = await transaction
      .select()
      .from(eventTeamResults)
      .where(
        and(eq(eventTeamResults.eventId, input.eventId), eq(eventTeamResults.teamId, input.teamId)),
      )
      .for("update")
      .limit(1);

    const [after] = await transaction
      .insert(eventTeamResults)
      .values({
        eventId: input.eventId,
        placementFrom: input.placementFrom,
        placementTo: input.placementTo,
        teamId: input.teamId,
      })
      .onConflictDoUpdate({
        target: [eventTeamResults.eventId, eventTeamResults.teamId],
        set: {
          placementFrom: input.placementFrom,
          placementTo: input.placementTo,
        },
      })
      .returning();
    const result = requireDomainValue(
      after,
      "EVENT_RESULT_UPDATE_FAILED",
      "Event result write returned no row",
    );

    await writeAdminAudit(transaction, {
      action: before ? "UPDATE_EVENT_RESULT" : "CREATE_EVENT_RESULT",
      actorAdminUserId: input.actorAdminUserId,
      after: result,
      before: before ?? null,
      reason,
      targetId: `${input.eventId}:${input.teamId}`,
      targetType: "EVENT_TEAM_RESULT",
    });

    return result;
  });
}
