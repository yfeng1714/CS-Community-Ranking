import type { NextRequest } from "next/server";

import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";
import { VisitorIdentityService } from "@/domain/visitors/service";
import { VoteResolutionService } from "@/domain/votes/resolution";
import { getLogger } from "@/observability/logger";
import { errorCodeFromResponse, recordApiMetric } from "@/observability/api-metrics";
import { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { getPublicRiskMonitor } from "@/security/runtime";

import { createResolveBallotHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let handler: ReturnType<typeof createResolveBallotHandler> | undefined;

function getHandler(): ReturnType<typeof createResolveBallotHandler> {
  if (!handler) {
    const env = getEnv();
    const database = getDatabase();
    handler = createResolveBallotHandler({
      appOrigin: env.APP_ORIGIN,
      onUnexpectedError(error) {
        const errorCode =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string" &&
          /^[A-Z0-9_]{1,64}$/.test(error.code)
            ? error.code
            : "UNKNOWN";
        getLogger().error(
          { errorCode, event: "ballot_resolution_failed" },
          "Ballot resolution failed",
        );
      },
      production: env.NODE_ENV === "production",
      rateLimiter: new BoundedFixedWindowRateLimiter(
        env.BALLOT_RESOLVE_RATE_LIMIT_PER_MINUTE,
        env.RATE_LIMITER_MAX_KEYS,
      ),
      riskMonitor: getPublicRiskMonitor(),
      resolution: new VoteResolutionService(database),
      visitorCookieMaxAgeDays: env.VISITOR_COOKIE_MAX_AGE_DAYS,
      visitorCookieName: env.VISITOR_COOKIE_NAME,
      visitors: new VisitorIdentityService(database, env.VISITOR_TOKEN_HASH_PEPPER),
    });
  }

  return handler;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
): Promise<Response> {
  const { publicId } = await context.params;
  const startedAt = performance.now();
  const response = await getHandler()(request, publicId);
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const errorCode = await errorCodeFromResponse(response);
  getLogger().info(
    {
      errorCode,
      event: "http_request",
      latencyMs,
      requestId: request.headers.get("x-request-id"),
      route: "/api/v1/ballots/{public_id}/resolve",
      statusCode: response.status,
    },
    "Public API request completed",
  );
  try {
    await recordApiMetric(getDatabase(), {
      errorCode,
      latencyMs,
      route: "/api/v1/ballots/{public_id}/resolve",
      statusCode: response.status,
    });
  } catch {
    getLogger().warn({ event: "api_metric_write_failed" }, "API metric write failed");
  }
  return response;
}
