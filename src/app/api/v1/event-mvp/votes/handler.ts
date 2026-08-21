import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { DomainError } from "@/domain/error";
import type { EventMvpService } from "@/domain/event-mvp/service";
import type { VisitorIdentityService } from "@/domain/visitors/service";
import { visitorCookieOptions } from "@/domain/visitors/service";
import type { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { mutationRejectionResponse, validateMutationRequest } from "@/security/mutation-request";
import type { PublicRiskMonitorLike, RiskInspection } from "@/security/risk-monitor";

const ROUTE = "/api/v1/event-mvp/votes";
const bodySchema = z
  .object({ playerSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })
  .strict();

function errorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { headers: { "cache-control": "no-store" }, status },
  );
}

export function createEventMvpVoteHandler(dependencies: {
  appOrigin: string;
  onUnexpectedError?(error: unknown): void;
  production: boolean;
  rateLimiter: Pick<BoundedFixedWindowRateLimiter, "check">;
  riskMonitor?: PublicRiskMonitorLike;
  service: Pick<EventMvpService, "vote">;
  visitorCookieMaxAgeDays: number;
  visitorCookieName: string;
  visitors: Pick<VisitorIdentityService, "resolve">;
}) {
  return async function eventMvpVoteHandler(request: NextRequest): Promise<Response> {
    const inspection: RiskInspection = dependencies.riskMonitor?.inspect(request.headers) ?? {
      infrastructureLimit: null,
      ipRiskKey: null,
    };
    if (inspection.infrastructureLimit && !inspection.infrastructureLimit.allowed) {
      const response = errorResponse(
        "INFRASTRUCTURE_RATE_LIMITED",
        "Too many public API requests; retry shortly",
        429,
      );
      response.headers.set(
        "retry-after",
        inspection.infrastructureLimit.retryAfterSeconds.toString(),
      );
      return response;
    }

    const guard = validateMutationRequest(request, {
      appOrigin: dependencies.appOrigin,
      production: dependencies.production,
    });
    if (!guard.ok) return mutationRejectionResponse(guard);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("INVALID_PLAYER_SLUG", "playerSlug must be a URL-safe slug", 400);
    }

    let tokenToSet: string | undefined;
    let visitorId: bigint | undefined;
    const attachVisitorCookie = (response: NextResponse): NextResponse => {
      if (tokenToSet) {
        response.cookies.set(
          dependencies.visitorCookieName,
          tokenToSet,
          visitorCookieOptions(dependencies.visitorCookieMaxAgeDays),
        );
      }
      return response;
    };

    try {
      const visitor = await dependencies.visitors.resolve(
        request.cookies.get(dependencies.visitorCookieName)?.value,
      );
      visitorId = visitor.id;
      tokenToSet = visitor.tokenToSet;
      const risk = dependencies.riskMonitor
        ? await dependencies.riskMonitor.assess({
            inspection,
            route: ROUTE,
            visitorCreated: visitor.created ?? false,
            visitorId: visitor.id,
          })
        : { ipRiskKey: inspection.ipRiskKey, reasonCodes: [] };
      const rateLimit = dependencies.rateLimiter.check(visitor.id.toString());
      if (!rateLimit.allowed) {
        const response = errorResponse(
          "INFRASTRUCTURE_RATE_LIMITED",
          "Too many event vote requests; retry shortly",
          429,
        );
        response.headers.set("retry-after", rateLimit.retryAfterSeconds.toString());
        return attachVisitorCookie(response);
      }

      const result = await dependencies.service.vote({
        ipRiskKey: risk.ipRiskKey,
        playerSlug: parsed.data.playerSlug,
        reasonCodes: risk.reasonCodes,
        visitorId: visitor.id,
      });
      return attachVisitorCookie(
        NextResponse.json(result, { headers: { "cache-control": "no-store" }, status: 200 }),
      );
    } catch (error) {
      if (error instanceof DomainError) {
        const mapped = {
          EVENT_MVP_ALREADY_VOTED: {
            message: "This visitor already voted today",
            status: 409,
          },
          EVENT_MVP_NOT_ACTIVE: { message: "The current event contest is not open", status: 409 },
          EVENT_MVP_PLAYER_NOT_FOUND: {
            message: "That player is not on the event ballot",
            status: 404,
          },
          VISITOR_DISABLED: { message: "Visitor access is disabled", status: 403 },
        }[error.code];
        if (mapped) {
          return attachVisitorCookie(errorResponse(error.code, mapped.message, mapped.status));
        }
      }
      dependencies.onUnexpectedError?.(error);
      void visitorId;
      return attachVisitorCookie(
        errorResponse("EVENT_MVP_VOTE_UNAVAILABLE", "Event vote is temporarily unavailable", 503),
      );
    }
  };
}
