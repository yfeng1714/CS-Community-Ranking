import { eq } from "drizzle-orm";

import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue, requireNonBlank } from "../error.ts";
import { players } from "../../db/schema/index.ts";

export type ProfessionalStatus = "ACTIVE" | "INACTIVE" | "RETIRED";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hltvPlayerPathPattern = /^\/player\/[1-9]\d*\/[^/]+\/?$/;

function normalizeSlug(value: string): string {
  const slug = requireNonBlank(value, "Player slug");
  if (!slugPattern.test(slug)) {
    throw new DomainError("INVALID_PLAYER_SLUG", "Player slug must be lowercase kebab-case");
  }
  return slug;
}

export function normalizeHltvProfileUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (candidate.length > 2_000) {
    throw new DomainError("INVALID_HLTV_PROFILE_URL", "HLTV profile URL is too long");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new DomainError("INVALID_HLTV_PROFILE_URL", "HLTV profile URL must be a valid URL");
  }

  if (
    url.protocol !== "https:" ||
    !["hltv.org", "www.hltv.org"].includes(url.hostname.toLowerCase()) ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !hltvPlayerPathPattern.test(url.pathname)
  ) {
    throw new DomainError(
      "INVALID_HLTV_PROFILE_URL",
      "HLTV profile URL must use https://www.hltv.org/player/{id}/{slug}",
    );
  }

  url.hostname = "www.hltv.org";
  return url.toString();
}

export interface CreatePlayerInput {
  actorAdminUserId: bigint;
  countryCode?: string | null | undefined;
  hltvProfileUrl?: string | null | undefined;
  nickname: string;
  photoPath?: string | null | undefined;
  professionalStatus?: ProfessionalStatus | undefined;
  realName?: string | null | undefined;
  reason: string;
  slug: string;
}

export async function createPlayer(database: AppDatabase, input: CreatePlayerInput) {
  const reason = requireNonBlank(input.reason, "Player creation reason");

  return database.transaction(async (transaction) => {
    const [player] = await transaction
      .insert(players)
      .values({
        countryCode: input.countryCode?.trim() || null,
        hltvProfileUrl: normalizeHltvProfileUrl(input.hltvProfileUrl),
        nickname: requireNonBlank(input.nickname, "Player nickname"),
        photoPath: input.photoPath?.trim() || null,
        professionalStatus: input.professionalStatus ?? "ACTIVE",
        realName: input.realName?.trim() || null,
        slug: normalizeSlug(input.slug),
      })
      .returning();
    const created = requireDomainValue(
      player,
      "PLAYER_CREATE_FAILED",
      "Player insertion returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "CREATE_PLAYER",
      actorAdminUserId: input.actorAdminUserId,
      after: created,
      reason,
      targetId: created.id.toString(),
      targetType: "PLAYER",
    });

    return created;
  });
}

export async function updatePlayer(
  database: AppDatabase,
  input: {
    actorAdminUserId: bigint;
    countryCode?: string | null | undefined;
    hltvProfileUrl?: string | null | undefined;
    nickname?: string | undefined;
    photoPath?: string | null | undefined;
    professionalStatus?: ProfessionalStatus | undefined;
    realName?: string | null | undefined;
    reason: string;
    slug?: string | undefined;
    playerId: bigint;
  },
) {
  const reason = requireNonBlank(input.reason, "Player update reason");

  return database.transaction(async (transaction) => {
    const [before] = await transaction
      .select()
      .from(players)
      .where(eq(players.id, input.playerId))
      .for("update")
      .limit(1);
    const current = requireDomainValue(
      before,
      "PLAYER_NOT_FOUND",
      `Player ${input.playerId} not found`,
    );

    const [after] = await transaction
      .update(players)
      .set({
        ...(input.countryCode === undefined
          ? {}
          : { countryCode: input.countryCode?.trim() || null }),
        ...(input.hltvProfileUrl === undefined
          ? {}
          : { hltvProfileUrl: normalizeHltvProfileUrl(input.hltvProfileUrl) }),
        ...(input.nickname === undefined
          ? {}
          : { nickname: requireNonBlank(input.nickname, "Player nickname") }),
        ...(input.photoPath === undefined ? {} : { photoPath: input.photoPath?.trim() || null }),
        ...(input.professionalStatus === undefined
          ? {}
          : { professionalStatus: input.professionalStatus }),
        ...(input.realName === undefined ? {} : { realName: input.realName?.trim() || null }),
        ...(input.slug === undefined ? {} : { slug: normalizeSlug(input.slug) }),
        updatedAt: new Date(),
      })
      .where(eq(players.id, input.playerId))
      .returning();
    const updated = requireDomainValue(
      after,
      "PLAYER_UPDATE_FAILED",
      "Player update returned no row",
    );

    await writeAdminAudit(transaction, {
      action: "UPDATE_PLAYER",
      actorAdminUserId: input.actorAdminUserId,
      after: updated,
      before: current,
      reason,
      targetId: current.id.toString(),
      targetType: "PLAYER",
    });

    return updated;
  });
}
