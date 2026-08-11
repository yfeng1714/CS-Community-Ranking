import { describe, expect, it } from "vitest";

import { dateInTimeZone } from "@/domain/ballots/date";

describe("dateInTimeZone", () => {
  it("uses the Asia/Shanghai calendar date across UTC midnight boundaries", () => {
    expect(dateInTimeZone(new Date("2026-08-10T15:59:59.999Z"), "Asia/Shanghai")).toBe(
      "2026-08-10",
    );
    expect(dateInTimeZone(new Date("2026-08-10T16:00:00.000Z"), "Asia/Shanghai")).toBe(
      "2026-08-11",
    );
  });
});
