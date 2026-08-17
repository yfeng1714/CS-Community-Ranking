import { describe, expect, it } from "vitest";

import { peakHltvTop20, top20YearPeriod } from "@/domain/external-data/top20";

describe("HLTV Top 20 peak aggregation", () => {
  it("lists every year that shares the highest rank", () => {
    expect(
      peakHltvTop20([
        { rank: 1, year: 2025 },
        { rank: 3, year: 2024 },
        { rank: 1, year: 2023 },
        { rank: 2, year: 2022 },
        { rank: 2, year: 2021 },
        { rank: 1, year: 2020 },
        { rank: 1, year: 2019 },
      ]),
    ).toEqual({ rank: 1, years: [2019, 2020, 2023, 2025] });
  });

  it("returns null when the player has no Top 20 placement", () => {
    expect(peakHltvTop20([])).toBeNull();
  });

  it("stores each year as a CAREER period on the shared snapshot table", () => {
    expect(top20YearPeriod(2023)).toEqual({
      periodEnd: "2023-12-31",
      periodStart: "2023-01-01",
    });
  });
});
