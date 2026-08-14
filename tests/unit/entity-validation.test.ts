import { describe, expect, it } from "vitest";

import type { AppDatabase } from "@/domain/database";
import { createEdition } from "@/domain/editions/service";
import { createEvent } from "@/domain/events/service";
import { normalizeHltvProfileUrl } from "@/domain/players/service";

const noDatabaseAccess = {} as AppDatabase;

describe("entity service validation", () => {
  it("rejects invalid Edition timestamps and integer settings before database access", async () => {
    const base = {
      actorAdminUserId: 1n,
      ballotTtlMinutes: 30,
      code: "2027",
      endsAt: new Date("2028-01-01T00:00:00.000Z"),
      fullWeightBallotsPerDay: 50,
      name: "2027 Edition",
      reason: "Validate Edition inputs",
      startsAt: new Date("2027-01-01T00:00:00.000Z"),
    };

    await expect(
      createEdition(noDatabaseAccess, { ...base, startsAt: new Date("invalid") }),
    ).rejects.toMatchObject({ code: "INVALID_EDITION_DATES" });
    await expect(
      createEdition(noDatabaseAccess, { ...base, fullWeightBallotsPerDay: 1.5 }),
    ).rejects.toMatchObject({ code: "INVALID_EDITION_QUOTA" });
  });

  it("requires a real calendar date and a public-safe Event slug", async () => {
    const base = {
      actorAdminUserId: 1n,
      endsAt: "2027-02-28",
      name: "Example Event",
      reason: "Validate Event inputs",
      slug: "example-event",
      startsAt: "2027-02-01",
    };

    await expect(
      createEvent(noDatabaseAccess, { ...base, endsAt: "2027-02-30" }),
    ).rejects.toMatchObject({
      code: "INVALID_DATE",
    });
    await expect(
      createEvent(noDatabaseAccess, { ...base, slug: "Example Event" }),
    ).rejects.toMatchObject({
      code: "INVALID_EVENT_SLUG",
    });
  });

  it("normalizes only direct HTTPS HLTV player-profile links", () => {
    expect(normalizeHltvProfileUrl(" https://hltv.org/player/11893/zywoo ")).toBe(
      "https://www.hltv.org/player/11893/zywoo",
    );
    expect(normalizeHltvProfileUrl("  ")).toBeNull();

    for (const invalid of [
      "http://www.hltv.org/player/11893/zywoo",
      "https://example.com/player/11893/zywoo",
      "https://www.hltv.org/team/9565/vitality",
      "https://www.hltv.org/player/11893/zywoo?utm_source=test",
    ]) {
      expect(() => normalizeHltvProfileUrl(invalid)).toThrowError(
        expect.objectContaining({ code: "INVALID_HLTV_PROFILE_URL" }),
      );
    }
  });
});
