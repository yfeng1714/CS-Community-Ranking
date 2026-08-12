import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminSessionCookieOptions, type AdminSessionService } from "@/domain/admin/auth";
import type { AppEnv } from "@/config/env";
import type { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { extractDailyIpRiskKey } from "@/security/ip-risk-key";

import { adminErrorResponse, guardAdminMutation, handleAdminError } from "../shared";

const loginSchema = z.strictObject({
  password: z.string().min(1).max(1024),
  username: z.string().min(1).max(100),
});

function rateLimitKey(request: NextRequest, env: AppEnv): string {
  const key = extractDailyIpRiskKey(request.headers, {
    clientIpMode: env.CLIENT_IP_MODE,
    now: new Date(),
    secret: env.IP_HMAC_SECRET,
    timeZone: env.APP_TIME_ZONE,
    trustProxyHeaders: env.TRUST_PROXY_HEADERS,
  });
  return key?.toString("base64url") ?? "direct";
}

interface Dependencies {
  env: AppEnv;
  onUnexpectedError?(error: unknown): void;
  rateLimiter: Pick<BoundedFixedWindowRateLimiter, "check">;
  sessions: Pick<AdminSessionService, "login">;
}

export function createAdminLoginHandler(dependencies: Dependencies) {
  return async function adminLoginHandler(request: NextRequest): Promise<Response> {
    const rejected = guardAdminMutation(request, dependencies.env);
    if (rejected) return rejected;

    const rateLimit = dependencies.rateLimiter.check(rateLimitKey(request, dependencies.env));
    if (!rateLimit.allowed) {
      const response = adminErrorResponse(
        "ADMIN_LOGIN_RATE_LIMITED",
        "Too many login attempts; retry shortly",
        429,
      );
      response.headers.set("retry-after", rateLimit.retryAfterSeconds.toString());
      return response;
    }

    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return adminErrorResponse("INVALID_ADMIN_JSON", "Request body must be valid JSON", 400);
      }
      const input = loginSchema.parse(body);
      const result = await dependencies.sessions.login(input);
      const response = NextResponse.json(
        { admin: { username: result.session.username } },
        { headers: { "cache-control": "no-store" } },
      );
      response.cookies.set(
        dependencies.env.ADMIN_SESSION_COOKIE_NAME,
        result.token,
        adminSessionCookieOptions(result.expiresAt),
      );
      return response;
    } catch (error) {
      return handleAdminError(error, dependencies.onUnexpectedError);
    }
  };
}
