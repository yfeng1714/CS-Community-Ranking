import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { countryFlagImageSrc } from "@/domain/public/country-flag";

describe("country flag images", () => {
  it("maps ISO-2 codes to local SVGs, including Windows-broken emoji flags", () => {
    expect(countryFlagImageSrc("BR")).toBe("/flags/br.svg");
    expect(countryFlagImageSrc("cn")).toBe("/flags/cn.svg");
    expect(countryFlagImageSrc("GB")).toBe("/flags/gb.svg");
    expect(existsSync("public/flags/br.svg")).toBe(true);
    expect(existsSync("public/flags/cn.svg")).toBe(true);
  });

  it("rejects values that are not a local ISO-2 flag", () => {
    expect(countryFlagImageSrc("France")).toBeNull();
    expect(countryFlagImageSrc("")).toBeNull();
    expect(countryFlagImageSrc("X")).toBeNull();
    expect(countryFlagImageSrc("ZZ")).toBeNull();
  });
});
