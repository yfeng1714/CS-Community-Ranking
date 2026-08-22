import { describe, expect, it } from "vitest";

import { requireIsoDate, shiftIsoDateByDays, shiftIsoDateByMonths } from "@/domain/date";

describe("requireIsoDate", () => {
  it("accepts real calendar dates, including leap day", () => {
    expect(requireIsoDate("2028-02-29", "Date")).toBe("2028-02-29");
  });

  it.each(["2026-02-29", "2026-02-30", "2026-13-01", "2026-04-31"])(
    "rejects impossible calendar date %s",
    (value) => {
      expect(() => requireIsoDate(value, "Date")).toThrow(/valid YYYY-MM-DD/);
    },
  );
});

describe("shiftIsoDateByMonths", () => {
  it("moves a mid-month date back three calendar months", () => {
    expect(shiftIsoDateByMonths("2026-08-16", -3)).toBe("2026-05-16");
  });

  it("clamps overflow days to the last day of the target month", () => {
    expect(shiftIsoDateByMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("shiftIsoDateByDays", () => {
  it("moves across month and year boundaries", () => {
    expect(shiftIsoDateByDays("2026-08-31", 2)).toBe("2026-09-02");
    expect(shiftIsoDateByDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
