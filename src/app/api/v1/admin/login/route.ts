import type { NextRequest } from "next/server";

import { getEnv } from "@/config/env";
import { getAdminSessionService } from "@/domain/admin/runtime";
import { getLogger } from "@/observability/logger";
import { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";

import { createAdminLoginHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let handler: ReturnType<typeof createAdminLoginHandler> | undefined;

export function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();
  handler ??= createAdminLoginHandler({
    env,
    onUnexpectedError(error) {
      getLogger().error({ err: error, event: "admin_login_failed" }, "Admin login failed");
    },
    rateLimiter: new BoundedFixedWindowRateLimiter(
      env.ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE,
      env.RATE_LIMITER_MAX_KEYS,
    ),
    sessions: getAdminSessionService(),
  });
  return handler(request);
}
