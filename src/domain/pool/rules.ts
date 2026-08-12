import { requireNonBlank } from "../error.ts";

export type AutomaticTeamAdmissionType = "CORE" | "REVIEW_AUTO";

export interface TeamEventEvidence {
  eventName: string;
  eventEndsAt: string;
  isMajor: boolean;
  isT1Whitelisted: boolean;
  placementFrom: number;
  placementTo: number;
}

export interface AutomaticTeamEvidence {
  editionYear: number;
  hltvRank?: number | null | undefined;
  vrsRank?: number | null | undefined;
  eventResults: readonly TeamEventEvidence[];
}

export interface AdmissionEvaluation<T extends string> {
  admissionType: T | null;
  eligible: boolean;
  reason: string | null;
  reasonCodes: readonly string[];
}

function validatePositiveRank(rank: number | null | undefined, label: string): void {
  if (rank !== null && rank !== undefined && (!Number.isInteger(rank) || rank <= 0)) {
    throw new RangeError(`${label} must be a positive integer when provided`);
  }
}

function bestQualifyingRank(input: AutomaticTeamEvidence, maximum: number): string | null {
  const matches: string[] = [];

  if (input.hltvRank !== null && input.hltvRank !== undefined && input.hltvRank <= maximum) {
    matches.push(`HLTV #${input.hltvRank}`);
  }

  if (input.vrsRank !== null && input.vrsRank !== undefined && input.vrsRank <= maximum) {
    matches.push(`VRS #${input.vrsRank}`);
  }

  return matches.length > 0 ? matches.join(" / ") : null;
}

function eventYear(event: TeamEventEvidence): number {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(event.eventEndsAt);

  if (!match) {
    throw new RangeError("eventEndsAt must use YYYY-MM-DD format");
  }

  const [year, month, day] = event.eventEndsAt.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError("eventEndsAt must be a real calendar date");
  }

  return Number(match[1]);
}

function qualifyingEventReason(input: AutomaticTeamEvidence): string | null {
  for (const event of input.eventResults) {
    requireNonBlank(event.eventName, "event name");

    if (
      !Number.isInteger(event.placementFrom) ||
      !Number.isInteger(event.placementTo) ||
      event.placementFrom <= 0 ||
      event.placementTo < event.placementFrom
    ) {
      throw new RangeError("event placement must be a positive ordered range");
    }

    if (eventYear(event) !== input.editionYear) {
      continue;
    }

    if (event.isMajor && event.placementTo <= 8) {
      return `Major Top 8 at ${event.eventName}`;
    }

    if (event.isT1Whitelisted && event.placementTo <= 4) {
      return `T1 Top 4 at ${event.eventName}`;
    }
  }

  return null;
}

export function evaluateAutomaticTeamAdmission(
  input: AutomaticTeamEvidence,
): AdmissionEvaluation<AutomaticTeamAdmissionType> {
  validatePositiveRank(input.hltvRank, "HLTV rank");
  validatePositiveRank(input.vrsRank, "VRS rank");

  if (!Number.isInteger(input.editionYear) || input.editionYear < 2000) {
    throw new RangeError("editionYear must be a valid natural year");
  }

  const coreRank = bestQualifyingRank(input, 12);
  if (coreRank) {
    return {
      admissionType: "CORE",
      eligible: true,
      reason: `${coreRank} qualifies for Core admission`,
      reasonCodes: ["TOP_12"],
    };
  }

  const reviewRank = bestQualifyingRank(input, 20);
  const resultReason = qualifyingEventReason(input);
  if (reviewRank && resultReason) {
    return {
      admissionType: "REVIEW_AUTO",
      eligible: true,
      reason: `${reviewRank} and ${resultReason} qualify for Review Auto admission`,
      reasonCodes: ["TOP_20", resultReason.startsWith("Major") ? "MAJOR_TOP_8" : "T1_TOP_4"],
    };
  }

  const reasonCodes = [
    ...(reviewRank ? [] : ["NOT_TOP_20"]),
    ...(resultReason ? [] : ["NO_QUALIFYING_EVENT_RESULT"]),
  ];

  return {
    admissionType: null,
    eligible: false,
    reason: null,
    reasonCodes,
  };
}

export function evaluateManualTeamAdmission(input: {
  approved: boolean;
  reason: string;
}): AdmissionEvaluation<"REVIEW_MANUAL"> {
  const reason = requireNonBlank(input.reason, "manual admission reason");

  return input.approved
    ? {
        admissionType: "REVIEW_MANUAL",
        eligible: true,
        reason,
        reasonCodes: ["OWNER_APPROVED_MANUAL"],
      }
    : {
        admissionType: null,
        eligible: false,
        reason: null,
        reasonCodes: ["MANUAL_APPROVAL_REQUIRED"],
      };
}

export function evaluateSpecialPlayerAdmission(input: {
  approved: boolean;
  professionalStatus: "ACTIVE" | "INACTIVE" | "RETIRED";
  reason: string;
}): AdmissionEvaluation<"SPECIAL"> {
  const reason = requireNonBlank(input.reason, "Special admission reason");
  const reasonCodes: string[] = [];

  if (!input.approved) {
    reasonCodes.push("SPECIAL_APPROVAL_REQUIRED");
  }

  if (input.professionalStatus !== "ACTIVE") {
    reasonCodes.push("PLAYER_NOT_ACTIVE");
  }

  return reasonCodes.length === 0
    ? {
        admissionType: "SPECIAL",
        eligible: true,
        reason,
        reasonCodes: ["OWNER_APPROVED_SPECIAL"],
      }
    : {
        admissionType: null,
        eligible: false,
        reason: null,
        reasonCodes,
      };
}
