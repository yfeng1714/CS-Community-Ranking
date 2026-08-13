import { describe, expect, it } from "vitest";

import { cliArgs } from "../../scripts/cli-args.ts";

describe("CLI argument normalization", () => {
  it("preserves direct options", () => {
    expect(cliArgs(["--edition", "2026"])).toEqual(["--edition", "2026"]);
  });

  it("removes pnpm's leading separator", () => {
    expect(cliArgs(["--", "--edition", "2026"])).toEqual(["--edition", "2026"]);
  });

  it("does not remove separators elsewhere", () => {
    expect(cliArgs(["--edition", "2026", "--"])).toEqual(["--edition", "2026", "--"]);
  });
});
