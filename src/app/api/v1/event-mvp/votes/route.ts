import type { NextRequest } from "next/server";

import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";
import { EventMvpService } from "@/domain/event-mvp/service";
import { VisitorIdentityService } from "@/domain/visitors/service";
import { getLogger } from "@/observability/logger";
import { errorCodeFromResponse, recordApiMetric } from "@/observability/api-metrics";
import { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { getPublicRiskMonitor } from "@/security/runtime";

import { createEventMvpVoteHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let handler: ReturnType<typeof createEventMvpVoteHandler> | undefined;

function getHandler(): ReturnType<typeof createEventMvpVoteHandler> {
  if (!handler) {
    const env = getEnv();
    const database = getDatabase();
    handler = createEventMvpVoteHandler({
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
        getLogger().error({ errorCode, event: "event_mvp_vote_failed" }, "Event MVP vote failed");
      },
      production: env.NODE_ENV === "production",
      rateLimiter: new BoundedFixedWindowRateLimiter(
        env.BALLOT_RESOLVE_RATE_LIMIT_PER_MINUTE,
        env.RATE_LIMITER_MAX_KEYS,
      ),
      riskMonitor: getPublicRiskMonitor(),
      service: new EventMvpService(database, {
        riskEnforcementMode: env.RISK_ENFORCEMENT_MODE,
        timeZone: env.APP_TIME_ZONE,
      }),
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
      route: "/api/v1/event-mvp/votes",
      statusCode: response.status,
    },
    "Public API request completed",
  );
  try {
    await recordApiMetric(getDatabase(), {
      errorCode,
      latencyMs,
      route: "/api/v1/event-mvp/votes",
      statusCode: response.status,
    });
  } catch {
    getLogger().warn({ event: "api_metric_write_failed" }, "API metric write failed");
  }
  return response;
}
