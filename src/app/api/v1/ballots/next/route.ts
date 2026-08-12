import type { NextRequest } from "next/server";

import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";
import { BallotIssuanceService } from "@/domain/ballots/service";
import { getRuntimeCandidatePoolService } from "@/domain/pool/runtime";
import { VisitorIdentityService } from "@/domain/visitors/service";
import { getLogger } from "@/observability/logger";
import { errorCodeFromResponse, recordApiMetric } from "@/observability/api-metrics";
import { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { getPublicRiskMonitor } from "@/security/runtime";

import { createNextBallotHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let handler: ReturnType<typeof createNextBallotHandler> | undefined;

function getHandler(): ReturnType<typeof createNextBallotHandler> {
  if (!handler) {
    const env = getEnv();
    const database = getDatabase();
    handler = createNextBallotHandler({
      appOrigin: env.APP_ORIGIN,
      ballotIssuance: new BallotIssuanceService(database, getRuntimeCandidatePoolService(), {
        riskEnforcementMode: env.RISK_ENFORCEMENT_MODE,
        timeZone: env.APP_TIME_ZONE,
      }),
      onUnexpectedError(error) {
        const errorCode =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string" &&
          /^[A-Z0-9_]{1,64}$/.test(error.code)
            ? error.code
            : "UNKNOWN";
        getLogger().error({ errorCode, event: "ballot_issuance_failed" }, "Ballot issuance failed");
      },
      production: env.NODE_ENV === "production",
      rateLimiter: new BoundedFixedWindowRateLimiter(
        env.BALLOT_NEXT_RATE_LIMIT_PER_MINUTE,
        env.RATE_LIMITER_MAX_KEYS,
      ),
      riskMonitor: getPublicRiskMonitor(),
      visitorCookieMaxAgeDays: env.VISITOR_COOKIE_MAX_AGE_DAYS,
      visitorCookieName: env.VISITOR_COOKIE_NAME,
      visitors: new VisitorIdentityService(database, env.VISITOR_TOKEN_HASH_PEPPER),
    });
  }

  return handler;
}

export async function POST(request: NextRequest): Promise<Response> {
  const startedAt = performance.now();
  const response = await getHandler()(request);
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const errorCode = await errorCodeFromResponse(response);
  getLogger().info(
    {
      errorCode,
      event: "http_request",
      latencyMs,
      requestId: request.headers.get("x-request-id"),
      route: "/api/v1/ballots/next",
      statusCode: response.status,
    },
    "Public API request completed",
  );
  try {
    await recordApiMetric(getDatabase(), {
      errorCode,
      latencyMs,
      route: "/api/v1/ballots/next",
      statusCode: response.status,
    });
  } catch {
    getLogger().warn({ event: "api_metric_write_failed" }, "API metric write failed");
  }
  return response;
}
