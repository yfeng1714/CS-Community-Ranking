import { describe, expect, it } from "vitest";

import {
  evaluateAutomaticTeamAdmission,
  evaluateManualTeamAdmission,
  evaluateSpecialPlayerAdmission,
} from "@/domain/pool/rules";

const baseEvidence = {
  editionYear: 2026,
  eventResults: [],
} as const;

describe("Candidate Pool rule evaluation", () => {
  it.each([
    { hltvRank: 12, vrsRank: null },
    { hltvRank: null, vrsRank: 1 },
    { hltvRank: 19, vrsRank: 11 },
  ])("admits either-source Top 12 as Core", (ranking) => {
    const result = evaluateAutomaticTeamAdmission({ ...baseEvidence, ...ranking });

    expect(result).toMatchObject({ admissionType: "CORE", eligible: true });
    expect(result.reasonCodes).toEqual(["TOP_12"]);
  });

  it("admits Top 20 plus a same-year whitelisted T1 Top 4 as Review Auto", () => {
    const result = evaluateAutomaticTeamAdmission({
      ...baseEvidence,
      hltvRank: 18,
      eventResults: [
        {
          eventEndsAt: "2026-04-12",
          eventName: "Fictional T1 Open",
          isMajor: false,
          isT1Whitelisted: true,
          placementFrom: 3,
          placementTo: 4,
        },
      ],
    });

    expect(result).toMatchObject({ admissionType: "REVIEW_AUTO", eligible: true });
    expect(result.reasonCodes).toEqual(["TOP_20", "T1_TOP_4"]);
  });

  it("admits Top 20 plus a Major Top 8 as Review Auto", () => {
    const result = evaluateAutomaticTeamAdmission({
      ...baseEvidence,
      vrsRank: 20,
      eventResults: [
        {
          eventEndsAt: "2026-06-21",
          eventName: "Fictional Major",
          isMajor: true,
          isT1Whitelisted: true,
          placementFrom: 5,
          placementTo: 8,
        },
      ],
    });

    expect(result).toMatchObject({ admissionType: "REVIEW_AUTO", eligible: true });
    expect(result.reasonCodes).toEqual(["TOP_20", "MAJOR_TOP_8"]);
  });

  it("does not qualify an old-year, non-whitelisted, or insufficient result", () => {
    const result = evaluateAutomaticTeamAdmission({
      ...baseEvidence,
      hltvRank: 13,
      eventResults: [
        {
          eventEndsAt: "2025-12-31",
          eventName: "Old T1 Event",
          isMajor: false,
          isT1Whitelisted: true,
          placementFrom: 1,
          placementTo: 1,
        },
        {
          eventEndsAt: "2026-05-01",
          eventName: "Unlisted Event",
          isMajor: false,
          isT1Whitelisted: false,
          placementFrom: 1,
          placementTo: 1,
        },
        {
          eventEndsAt: "2026-07-01",
          eventName: "Fictional Major",
          isMajor: true,
          isT1Whitelisted: true,
          placementFrom: 9,
          placementTo: 12,
        },
      ],
    });

    expect(result).toMatchObject({ admissionType: null, eligible: false });
    expect(result.reasonCodes).toContain("NO_QUALIFYING_EVENT_RESULT");
  });

  it("does not treat an overlapping placement range as fully Top 4 or Top 8", () => {
    const t1 = evaluateAutomaticTeamAdmission({
      ...baseEvidence,
      hltvRank: 13,
      eventResults: [
        {
          eventEndsAt: "2026-04-12",
          eventName: "Wide T1 bracket",
          isMajor: false,
          isT1Whitelisted: true,
          placementFrom: 3,
          placementTo: 6,
        },
      ],
    });
    const major = evaluateAutomaticTeamAdmission({
      ...baseEvidence,
      hltvRank: 13,
      eventResults: [
        {
          eventEndsAt: "2026-06-21",
          eventName: "Wide Major bracket",
          isMajor: true,
          isT1Whitelisted: true,
          placementFrom: 5,
          placementTo: 12,
        },
      ],
    });

    expect(t1.eligible).toBe(false);
    expect(major.eligible).toBe(false);
  });

  it("requires explicit approval and a public reason for Manual admission", () => {
    expect(
      evaluateManualTeamAdmission({ approved: true, reason: "Regional representation" }),
    ).toMatchObject({ admissionType: "REVIEW_MANUAL", eligible: true });
    expect(
      evaluateManualTeamAdmission({ approved: false, reason: "Regional representation" }),
    ).toMatchObject({ admissionType: null, eligible: false });
    expect(() => evaluateManualTeamAdmission({ approved: true, reason: " " })).toThrow(
      /must not be blank/,
    );
  });

  it("limits Special admission to approved ACTIVE or RETIRED professionals", () => {
    expect(
      evaluateSpecialPlayerAdmission({
        approved: true,
        professionalStatus: "ACTIVE",
        reason: "Exceptional active individual inclusion",
      }),
    ).toMatchObject({ admissionType: "SPECIAL", eligible: true });
    expect(
      evaluateSpecialPlayerAdmission({
        approved: true,
        professionalStatus: "RETIRED",
        reason: "Owner-approved retired Special inclusion",
      }),
    ).toMatchObject({ admissionType: "SPECIAL", eligible: true });
    expect(
      evaluateSpecialPlayerAdmission({
        approved: true,
        professionalStatus: "INACTIVE",
        reason: "Historical popularity",
      }),
    ).toMatchObject({ admissionType: null, eligible: false });
  });
});
