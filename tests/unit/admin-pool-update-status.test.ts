import { describe, expect, it } from "vitest";

import { summarizePoolUpdateStatus } from "@/domain/admin/pool-update-status";

const source = (provider: "HLTV" | "VALVE_VRS", approvedAt: Date | null) => ({
  approvedAt,
  capturedAt: new Date("2026-08-15T00:00:00Z"),
  id: provider === "HLTV" ? 1n : 2n,
  parserVersion: "fixture",
  provider,
  publishedAt: new Date("2026-08-10T00:00:00Z"),
  recordCount: provider === "HLTV" ? 20 : 396,
});

const draft = (startedAt = new Date("2026-08-15T02:00:00Z"), status = "SUCCEEDED" as const) => ({
  finishedAt: new Date(startedAt.getTime() + 1_000),
  id: 3n,
  startedAt,
  status,
});

describe("Admin Pool update status", () => {
  it("directs the operator through missing, approval, draft, and proposal states", () => {
    expect(
      summarizePoolUpdateStatus({ draftRuns: [], proposals: [], sources: [] }).nextAction,
    ).toBe("SYNC_MISSING_SOURCE");

    expect(
      summarizePoolUpdateStatus({
        draftRuns: [],
        proposals: [],
        sources: [source("HLTV", null), source("VALVE_VRS", new Date("2026-08-15T01:00:00Z"))],
      }).nextAction,
    ).toBe("APPROVE_SOURCE");

    const approvedSources = [
      source("HLTV", new Date("2026-08-15T01:00:00Z")),
      source("VALVE_VRS", new Date("2026-08-15T01:00:00Z")),
    ];
    expect(
      summarizePoolUpdateStatus({ draftRuns: [], proposals: [], sources: approvedSources })
        .nextAction,
    ).toBe("RUN_POOL_DRAFT");

    expect(
      summarizePoolUpdateStatus({
        draftRuns: [draft()],
        proposals: [{ changeType: "POOL_TEAM", conflictCodes: [], status: "PENDING" }],
        sources: approvedSources,
      }).nextAction,
    ).toBe("REVIEW_POOL_PROPOSALS");
  });

  it("surfaces draft conflicts before ordinary proposal review", () => {
    const result = summarizePoolUpdateStatus({
      draftRuns: [draft()],
      proposals: [
        {
          changeType: "POOL_TEAM",
          conflictCodes: ["HLTV_ROSTER_MISMATCH"],
          status: "PENDING",
        },
      ],
      sources: [
        source("HLTV", new Date("2026-08-15T01:00:00Z")),
        source("VALVE_VRS", new Date("2026-08-15T01:00:00Z")),
      ],
    });

    expect(result.nextAction).toBe("REVIEW_DRAFT_RESULT");
    expect(result.blockedPoolProposals).toBe(1);
  });

  it("marks the workflow current only after a successful fresh draft with no proposals", () => {
    const result = summarizePoolUpdateStatus({
      draftRuns: [draft()],
      proposals: [],
      sources: [
        source("HLTV", new Date("2026-08-15T01:00:00Z")),
        source("VALVE_VRS", new Date("2026-08-15T01:00:00Z")),
      ],
    });

    expect(result.nextAction).toBe("UP_TO_DATE");
    expect(result.draftOutdated).toBe(false);
  });
});
