import { describe, expect, it } from "vitest";

import {
  CAREER_RATING_LABEL,
  formatAdr,
  formatFirepower,
  formatInteger,
  formatPlayerHonors,
  formatRating,
  formatTop20Peak,
  headlineRating,
  RECENT_RATING_LABEL,
} from "@/components/player-stat-format";

describe("player stat formatters", () => {
  it("keeps missing values as an em dash", () => {
    expect(formatRating(null)).toBe("—");
    expect(formatFirepower(null)).toBe("—");
    expect(formatAdr(null)).toBe("—");
    expect(formatInteger(null)).toBe("—");
    expect(formatPlayerHonors(null, null)).toBeNull();
    expect(formatTop20Peak(null)).toBe("—");
  });

  it("formats Firepower as N/100 and honors without inventing the missing side", () => {
    expect(formatFirepower(98)).toBe("98/100");
    expect(formatFirepower(0)).toBe("0/100");
    expect(formatPlayerHonors(2, 32)).toBe("🏆 2 Major · 🏅 32 MVP");
    expect(formatPlayerHonors(0, 0)).toBe("🏆 0 Major · 🏅 0 MVP");
    expect(formatPlayerHonors(3, null)).toBe("🏆 3 Major");
    expect(formatAdr(85.4)).toBe("85.4");
    expect(formatTop20Peak({ rank: 1, years: [2019, 2020, 2023, 2025] })).toBe(
      "#1 · 2019, 2020, 2023, 2025",
    );
    expect(formatTop20Peak({ rank: 3, years: [2023] })).toBe("#3 · 2023");
  });

  it("uses career Rating only when the three-month Rating is missing", () => {
    expect(headlineRating({ careerRating: 0.78, recentRating: 1.14 })).toEqual({
      label: RECENT_RATING_LABEL,
      value: 1.14,
    });
    expect(headlineRating({ careerRating: 0.78, recentRating: null })).toEqual({
      label: CAREER_RATING_LABEL,
      value: 0.78,
    });
    expect(headlineRating({ careerRating: null, recentRating: null })).toEqual({
      label: RECENT_RATING_LABEL,
      value: null,
    });
  });
});
