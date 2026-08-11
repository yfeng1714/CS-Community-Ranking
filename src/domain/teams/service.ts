import { eq } from "drizzle-orm";

import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import { teams } from "../../db/schema/index.ts";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(value: string): string {
  const slug = requireNonBlank(value, "Team slug");
  if (!slugPattern.test(slug)) {
    throw new DomainError("INVALID_TEAM_SLUG", "Team slug must be lowercase kebab-case");
  }
  return slug;
}

export async function createTeam(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    countryCode?: string | null;
    logoPath?: string | null;
    name: string;
    reason: string;
    shortName?: string | null;
    slug: string;
  },
) {
  const reason = requireNonBlank(input.reason, "Team creation reason");

  return database.transaction(async (transaction) => {
    const [team] = await transaction
      .insert(teams)
      .values({
        countryCode: input.countryCode?.trim() || null,
        logoPath: input.logoPath?.trim() || null,
        name: requireNonBlank(input.name, "Team name"),
        shortName: input.shortName?.trim() || null,
        slug: normalizeSlug(input.slug),
      })
      .returning();
    const created = requireDomainValue(
      team,
      "TEAM_CREATE_FAILED",
      "Team insertion returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "CREATE_TEAM",
      actorAdminUserId: input.actorAdminUserId,
      after: created,
      reason,
      targetId: created.id.toString(),
      targetType: "TEAM",
    });

    return created;
  });
}

export async function updateTeam(
  database: AppDatabase,
  input: {
    active?: boolean;
    actorAdminUserId: bigint;
    countryCode?: string | null;
    logoPath?: string | null;
    name?: string;
    reason: string;
    shortName?: string | null;
    slug?: string;
    teamId: bigint;
  },
) {
  const reason = requireNonBlank(input.reason, "Team update reason");

  return database.transaction(async (transaction) => {
    const [before] = await transaction
      .select()
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .for("update")
      .limit(1);
    const current = requireDomainValue(before, "TEAM_NOT_FOUND", `Team ${input.teamId} not found`);

    const [after] = await transaction
      .update(teams)
      .set({
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.countryCode === undefined
          ? {}
          : { countryCode: input.countryCode?.trim() || null }),
        ...(input.logoPath === undefined ? {} : { logoPath: input.logoPath?.trim() || null }),
        ...(input.name === undefined ? {} : { name: requireNonBlank(input.name, "Team name") }),
        ...(input.shortName === undefined ? {} : { shortName: input.shortName?.trim() || null }),
        ...(input.slug === undefined ? {} : { slug: normalizeSlug(input.slug) }),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, input.teamId))
      .returning();
    const updated = requireDomainValue(after, "TEAM_UPDATE_FAILED", "Team update returned no row");

    await writeAdminAudit(transaction, {
      action: "UPDATE_TEAM",
      actorAdminUserId: input.actorAdminUserId,
      after: updated,
      before: current,
      reason,
      targetId: current.id.toString(),
      targetType: "TEAM",
    });

    return updated;
  });
}
