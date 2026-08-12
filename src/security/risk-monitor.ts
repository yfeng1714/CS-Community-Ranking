import { count, eq } from "drizzle-orm";

import { riskObservations } from "@/db/schema";
import type { AppDatabase } from "@/domain/database";
import { BoundedFixedWindowRateLimiter, type RateLimitResult } from "@/security/rate-limiter";

import { extractDailyIpRiskKey } from "./ip-risk-key";

export type RiskReasonCode =
  | "ABNORMAL_NEW_VISITOR_CHURN"
  | "EXTREME_REQUEST_VELOCITY"
  | "IMPOSSIBLE_CLIENT_FLOW"
  | "REPEATED_BALLOT_REPLAY_MISMATCH"
  | "REPEATED_INVALID_BALLOT_OWNERSHIP";

type ObservationCode =
  "BALLOT_REPLAY_MISMATCH" | "IMPOSSIBLE_CLIENT_FLOW" | "INVALID_BALLOT_OWNERSHIP" | "NEW_VISITOR";

export interface RiskInspection {
  infrastructureLimit: RateLimitResult | null;
  ipRiskKey: Buffer | null;
}

export interface RiskAssessment {
  ipRiskKey: Buffer | null;
  reasonCodes: RiskReasonCode[];
}

export class PublicRiskMonitor {
  private readonly ipLimiter: BoundedFixedWindowRateLimiter;

  constructor(
    private readonly database: AppDatabase,
    private readonly options: {
      clientIpMode: "cloudflare" | "railway";
      invalidOwnershipThreshold: number;
      impossibleFlowThreshold: number;
      ipHmacSecret: string;
      maximumKeys: number;
      newVisitorThreshold: number;
      publicApiLimit: number;
      replayMismatchThreshold: number;
      requestVelocityThreshold: number;
      timeZone: string;
      trustProxyHeaders: boolean;
    },
    private readonly now: () => Date = () => new Date(),
  ) {
    this.ipLimiter = new BoundedFixedWindowRateLimiter(options.publicApiLimit, options.maximumKeys);
  }

  inspect(headers: Pick<Headers, "get">): RiskInspection {
    const ipRiskKey = extractDailyIpRiskKey(headers, {
      clientIpMode: this.options.clientIpMode,
      now: this.now(),
      secret: this.options.ipHmacSecret,
      timeZone: this.options.timeZone,
      trustProxyHeaders: this.options.trustProxyHeaders,
    });
    return {
      infrastructureLimit: this.ipLimiter.check(ipRiskKey?.toString("base64url") ?? "unattributed"),
      ipRiskKey,
    };
  }

  async assess(input: {
    inspection: RiskInspection;
    route: string;
    visitorCreated: boolean;
    visitorId: bigint;
  }): Promise<RiskAssessment> {
    const { ipRiskKey } = input.inspection;
    if (input.visitorCreated) {
      await this.record({
        ipRiskKey,
        reasonCode: "NEW_VISITOR",
        route: input.route,
        visitorId: input.visitorId,
      });
      if (input.route === "/api/v1/ballots/{public_id}/resolve") {
        await this.record({
          ipRiskKey,
          reasonCode: "IMPOSSIBLE_CLIENT_FLOW",
          route: input.route,
          visitorId: input.visitorId,
        });
      }
    }

    const reasonCodes: RiskReasonCode[] = [];
    const requestCount = input.inspection.infrastructureLimit?.currentCount ?? 0;
    if (ipRiskKey && requestCount > this.options.requestVelocityThreshold) {
      reasonCodes.push("EXTREME_REQUEST_VELOCITY");
    }
    if (!ipRiskKey) return { ipRiskKey, reasonCodes };

    const counts = await this.database
      .select({ reasonCode: riskObservations.reasonCode, total: count() })
      .from(riskObservations)
      .where(eq(riskObservations.ipRiskKey, ipRiskKey))
      .groupBy(riskObservations.reasonCode);
    const total = (code: ObservationCode) =>
      Number(counts.find((row) => row.reasonCode === code)?.total ?? 0);

    if (total("NEW_VISITOR") > this.options.newVisitorThreshold) {
      reasonCodes.push("ABNORMAL_NEW_VISITOR_CHURN");
    }
    if (total("INVALID_BALLOT_OWNERSHIP") >= this.options.invalidOwnershipThreshold) {
      reasonCodes.push("REPEATED_INVALID_BALLOT_OWNERSHIP");
    }
    if (total("BALLOT_REPLAY_MISMATCH") >= this.options.replayMismatchThreshold) {
      reasonCodes.push("REPEATED_BALLOT_REPLAY_MISMATCH");
    }
    if (total("IMPOSSIBLE_CLIENT_FLOW") >= this.options.impossibleFlowThreshold) {
      reasonCodes.push("IMPOSSIBLE_CLIENT_FLOW");
    }
    return { ipRiskKey, reasonCodes: [...new Set(reasonCodes)].sort() };
  }

  async record(input: {
    ipRiskKey: Buffer | null;
    reasonCode: ObservationCode;
    route: string;
    visitorId: bigint | null;
  }): Promise<void> {
    if (!input.ipRiskKey) return;
    await this.database.insert(riskObservations).values({
      ipRiskKey: input.ipRiskKey,
      reasonCode: input.reasonCode,
      route: input.route,
      visitorId: input.visitorId,
    });
  }

  async recordResolutionFailure(input: {
    errorCode: string;
    ipRiskKey: Buffer | null;
    route: string;
    visitorId: bigint;
  }): Promise<void> {
    const reasonCode =
      input.errorCode === "BALLOT_NOT_FOUND"
        ? "INVALID_BALLOT_OWNERSHIP"
        : input.errorCode === "BALLOT_ALREADY_RESOLVED"
          ? "BALLOT_REPLAY_MISMATCH"
          : null;
    if (!reasonCode) return;
    await this.record({ ...input, reasonCode });
  }
}

export type PublicRiskMonitorLike = Pick<
  PublicRiskMonitor,
  "assess" | "inspect" | "recordResolutionFailure"
>;
