export type PoolUpdateNextAction =
  | "APPROVE_SOURCE"
  | "REVIEW_DRAFT_RESULT"
  | "REVIEW_POOL_PROPOSALS"
  | "RUN_POOL_DRAFT"
  | "SYNC_MISSING_SOURCE"
  | "UP_TO_DATE";

export interface PoolUpdateSourceInput {
  approvedAt: Date | null;
  capturedAt: Date;
  id: bigint;
  parserVersion: string;
  provider: "HLTV" | "VALVE_VRS";
  publishedAt: Date | null;
  recordCount: number | null;
}

export interface PoolUpdateDraftInput {
  finishedAt: Date | null;
  id: bigint;
  startedAt: Date;
  status: "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
}

export interface PoolUpdateProposalInput {
  changeType: string;
  conflictCodes: string[];
  status: string;
}

const requiredProviders = ["HLTV", "VALVE_VRS"] as const;

export function summarizePoolUpdateStatus(input: {
  draftRuns: PoolUpdateDraftInput[];
  proposals: PoolUpdateProposalInput[];
  sources: PoolUpdateSourceInput[];
}) {
  const latestSources = new Map<"HLTV" | "VALVE_VRS", PoolUpdateSourceInput>();
  const latestApprovedSources = new Map<"HLTV" | "VALVE_VRS", PoolUpdateSourceInput>();
  for (const source of input.sources) {
    if (!latestSources.has(source.provider)) latestSources.set(source.provider, source);
    if (source.approvedAt && !latestApprovedSources.has(source.provider)) {
      latestApprovedSources.set(source.provider, source);
    }
  }

  const missingProviders = requiredProviders.filter((provider) => !latestSources.has(provider));
  const awaitingApprovalProviders = requiredProviders.filter(
    (provider) => latestSources.get(provider)?.approvedAt === null,
  );
  const latestDraft = input.draftRuns[0] ?? null;
  const latestApprovedAt = Math.max(
    ...requiredProviders.map(
      (provider) => latestApprovedSources.get(provider)?.approvedAt?.getTime() ?? 0,
    ),
  );
  const draftOutdated = latestDraft === null || latestDraft.startedAt.getTime() < latestApprovedAt;
  const pendingPoolProposals = input.proposals.filter(
    (proposal) => proposal.status === "PENDING" && proposal.changeType === "POOL_TEAM",
  );
  const blockedPoolProposals = pendingPoolProposals.filter(
    (proposal) => proposal.conflictCodes.length > 0,
  );

  let nextAction: PoolUpdateNextAction;
  if (missingProviders.length > 0) nextAction = "SYNC_MISSING_SOURCE";
  else if (awaitingApprovalProviders.length > 0) nextAction = "APPROVE_SOURCE";
  else if (draftOutdated) nextAction = "RUN_POOL_DRAFT";
  else if (latestDraft.status !== "SUCCEEDED" || blockedPoolProposals.length > 0) {
    nextAction = "REVIEW_DRAFT_RESULT";
  } else if (pendingPoolProposals.length > 0) nextAction = "REVIEW_POOL_PROPOSALS";
  else nextAction = "UP_TO_DATE";

  return {
    awaitingApprovalProviders,
    blockedPoolProposals: blockedPoolProposals.length,
    draftOutdated,
    latestDraft,
    latestSources: requiredProviders.map((provider) => latestSources.get(provider) ?? null),
    missingProviders,
    nextAction,
    pendingPoolProposals: pendingPoolProposals.length,
  };
}
