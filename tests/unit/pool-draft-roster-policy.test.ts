import { describe, expect, it } from "vitest";

import { classifyPoolDraftRosterEvidence } from "@/domain/external-data/pool-draft";

const currentRoster = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];

describe("Pool-draft roster authority", () => {
  it("treats a VRS disagreement as retained evidence after applying HLTV authority", () => {
    expect(
      classifyPoolDraftRosterEvidence(
        "VALVE_VRS",
        ["OldAlpha", "Bravo", "Charlie", "Delta", "Echo"],
        currentRoster,
      ),
    ).toEqual({
      conflicts: [],
      warnings: ["VALVE_VRS_ROSTER_MISMATCH", "HLTV_ROSTER_AUTHORITY_APPLIED"],
    });
  });

  it("still blocks an HLTV disagreement", () => {
    expect(
      classifyPoolDraftRosterEvidence(
        "HLTV",
        ["OldAlpha", "Bravo", "Charlie", "Delta", "Echo"],
        currentRoster,
      ),
    ).toEqual({ conflicts: ["HLTV_ROSTER_MISMATCH"], warnings: [] });
  });

  it("accepts equivalent case-insensitive current rosters", () => {
    expect(
      classifyPoolDraftRosterEvidence(
        "HLTV",
        ["alpha", "BRAVO", "Charlie", "Delta", "Echo"],
        currentRoster,
      ),
    ).toEqual({ conflicts: [], warnings: [] });
  });
});
