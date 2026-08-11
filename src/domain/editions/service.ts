import { and, eq, ne } from "drizzle-orm";

import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import { ballots, editions } from "../../db/schema/index.ts";

export type EditionStatus = "DRAFT" | "ACTIVE" | "FROZEN" | "ARCHIVED";

const allowedTransitions: Readonly<Record<EditionStatus, readonly EditionStatus[]>> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["FROZEN"],
  FROZEN: ["ARCHIVED"],
  ARCHIVED: [],
};

export async function createEdition(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    ballotTtlMinutes: number;
    code: string;
    endsAt: Date;
    fullWeightBallotsPerDay: number;
    name: string;
    reason: string;
    startsAt: Date;
  },
) {
  const code = requireNonBlank(input.code, "Edition code");
  const name = requireNonBlank(input.name, "Edition name");
  const reason = requireNonBlank(input.reason, "Edition creation reason");

  if (!/^\d{4}$/.test(code)) {
    throw new DomainError("INVALID_EDITION_CODE", "Edition code must be a four-digit year");
  }

  if (input.endsAt <= input.startsAt) {
    throw new DomainError("INVALID_EDITION_DATES", "Edition end must be after its start");
  }

  return database.transaction(async (transaction) => {
    const [edition] = await transaction
      .insert(editions)
      .values({
        ballotTtlMinutes: input.ballotTtlMinutes,
        code,
        endsAt: input.endsAt,
        fullWeightBallotsPerDay: input.fullWeightBallotsPerDay,
        name,
        startsAt: input.startsAt,
        status: "DRAFT",
      })
      .returning();
    const created = requireDomainValue(
      edition,
      "EDITION_CREATE_FAILED",
      "Edition insertion returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "CREATE_EDITION",
      actorAdminUserId: input.actorAdminUserId,
      after: created,
      reason,
      targetId: created.id.toString(),
      targetType: "EDITION",
    });

    return created;
  });
}

export async function transitionEdition(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    editionId: bigint;
    reason: string;
    status: EditionStatus;
  },
) {
  const reason = requireNonBlank(input.reason, "Edition transition reason");

  return database.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(editions)
      .where(eq(editions.id, input.editionId))
      .for("update")
      .limit(1);
    const edition = requireDomainValue(
      current,
      "EDITION_NOT_FOUND",
      `Edition ${input.editionId} does not exist`,
    );

    if (edition.status === input.status) {
      return edition;
    }

    if (!allowedTransitions[edition.status].includes(input.status)) {
      throw new DomainError(
        "INVALID_EDITION_TRANSITION",
        `Edition cannot transition from ${edition.status} to ${input.status}`,
      );
    }

    if (input.status === "ACTIVE") {
      const [otherActive] = await transaction
        .select({ id: editions.id })
        .from(editions)
        .where(and(eq(editions.status, "ACTIVE"), ne(editions.id, input.editionId)))
        .limit(1);

      if (otherActive) {
        throw new DomainError("ACTIVE_EDITION_EXISTS", "Another Edition is already active");
      }
    }

    if (edition.status === "ACTIVE") {
      await transaction
        .update(ballots)
        .set({ status: "EXPIRED" })
        .where(and(eq(ballots.editionId, edition.id), eq(ballots.status, "OPEN")));
    }

    const [updated] = await transaction
      .update(editions)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(editions.id, edition.id))
      .returning();
    const changed = requireDomainValue(
      updated,
      "EDITION_UPDATE_FAILED",
      "Edition transition returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "TRANSITION_EDITION",
      actorAdminUserId: input.actorAdminUserId,
      after: changed,
      before: edition,
      reason,
      targetId: edition.id.toString(),
      targetType: "EDITION",
    });

    return changed;
  });
}
