import type { NextRequest } from "next/server";

import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";
import { recordProductEvent } from "@/domain/analytics/events";
import { VisitorIdentityService } from "@/domain/visitors/service";
import { getLogger } from "@/observability/logger";
import { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { getPublicRiskMonitor } from "@/security/runtime";

import { createProductEventHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let handler: ReturnType<typeof createProductEventHandler> | undefined;

function getHandler() {
  if (!handler) {
    const env = getEnv();
    const database = getDatabase();
    handler = createProductEventHandler({
      appOrigin: env.APP_ORIGIN,
      onUnexpectedError() {
        getLogger().warn({ event: "product_event_write_failed" }, "Product event write failed");
      },
      production: env.NODE_ENV === "production",
      rateLimiter: new BoundedFixedWindowRateLimiter(120, env.RATE_LIMITER_MAX_KEYS),
      recordEvent: (input) => recordProductEvent(database, input),
      riskMonitor: getPublicRiskMonitor(),
      visitorCookieName: env.VISITOR_COOKIE_NAME,
      visitors: new VisitorIdentityService(database, env.VISITOR_TOKEN_HASH_PEPPER),
    });
  }
  return handler;
}

export function POST(request: NextRequest): Promise<Response> {
  const startedAt = performance.now();
  return getHandler()(request).then((response) => {
    getLogger().info(
      {
        event: "http_request",
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        requestId: request.headers.get("x-request-id"),
        route: "/api/v1/events",
        statusCode: response.status,
      },
      "Public API request completed",
    );
    return response;
  });
}
