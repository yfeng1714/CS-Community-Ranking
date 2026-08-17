import { describe, expect, it } from "vitest";

import { countryFlagEmoji } from "@/domain/public/country-flag";

describe("country flag emoji", () => {
  it("turns ISO-2 codes into regional-indicator flags", () => {
    expect(countryFlagEmoji("FR")).toBe("🇫🇷");
    expect(countryFlagEmoji("dk")).toBe("🇩🇰");
    expect(countryFlagEmoji("GB")).toBe("🇬🇧");
  });

  it("rejects values that are not ISO-2", () => {
    expect(countryFlagEmoji("France")).toBeNull();
    expect(countryFlagEmoji("")).toBeNull();
    expect(countryFlagEmoji("X")).toBeNull();
  });
});
