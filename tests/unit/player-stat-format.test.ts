import { describe, expect, it } from "vitest";

import {
  formatAdr,
  formatFirepower,
  formatInteger,
  formatPlayerHonors,
  formatRating,
} from "@/components/player-stat-format";

describe("player stat formatters", () => {
  it("keeps missing values as an em dash", () => {
    expect(formatRating(null)).toBe("—");
    expect(formatFirepower(null)).toBe("—");
    expect(formatAdr(null)).toBe("—");
    expect(formatInteger(null)).toBe("—");
    expect(formatPlayerHonors(null, null)).toBeNull();
  });

  it("formats Firepower as N/100 and honors without inventing the missing side", () => {
    expect(formatFirepower(98)).toBe("98/100");
    expect(formatFirepower(0)).toBe("0/100");
    expect(formatPlayerHonors(2, 32)).toBe("2 Major · 32 MVP");
    expect(formatPlayerHonors(0, 0)).toBe("0 Major · 0 MVP");
    expect(formatPlayerHonors(3, null)).toBe("3 Major");
    expect(formatAdr(85.4)).toBe("85.4");
  });
});
