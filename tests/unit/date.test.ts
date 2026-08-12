import { describe, expect, it } from "vitest";

import { requireIsoDate } from "@/domain/date";

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
