import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { BallotIssuanceService } from "@/domain/ballots/service";
import { DomainError } from "@/domain/error";
import type { VisitorIdentityService } from "@/domain/visitors/service";
import { visitorCookieOptions } from "@/domain/visitors/service";
import type { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { mutationRejectionResponse, validateMutationRequest } from "@/security/mutation-request";
import type { PublicRiskMonitorLike } from "@/security/risk-monitor";

const ROUTE = "/api/v1/ballots/next";

interface NextBallotHandlerDependencies {
  appOrigin: string;
  ballotIssuance: Pick<BallotIssuanceService, "issue">;
  onUnexpectedError?(error: unknown): void;
  production: boolean;
  rateLimiter: Pick<BoundedFixedWindowRateLimiter, "check">;
  riskMonitor?: PublicRiskMonitorLike;
  visitorCookieMaxAgeDays: number;
  visitorCookieName: string;
  visitors: Pick<VisitorIdentityService, "resolve">;
}

function errorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { headers: { "cache-control": "no-store" }, status },
  );
}

export function createNextBallotHandler(dependencies: NextBallotHandlerDependencies) {
  return async function nextBallotHandler(request: NextRequest): Promise<Response> {
    const inspection = dependencies.riskMonitor?.inspect(request.headers) ?? {
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
    if (!guard.ok) {
      return mutationRejectionResponse(guard);
    }

    let tokenToSet: string | undefined;
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
      tokenToSet = visitor.tokenToSet;
      const risk = dependencies.riskMonitor
        ? await dependencies.riskMonitor.assess({
            inspection,
            route: ROUTE,
            visitorCreated: visitor.created ?? false,
            visitorId: visitor.id,
          })
        : { ipRiskKey: null, reasonCodes: [] };

      const rateLimit = dependencies.rateLimiter.check(visitor.id.toString());
      if (!rateLimit.allowed) {
        const response = errorResponse(
          "INFRASTRUCTURE_RATE_LIMITED",
          "Too many Ballot requests; retry shortly",
          429,
        );
        response.headers.set("retry-after", rateLimit.retryAfterSeconds.toString());
        return attachVisitorCookie(response);
      }

      return attachVisitorCookie(
        NextResponse.json(await dependencies.ballotIssuance.issue(visitor.id, risk), {
          headers: { "cache-control": "no-store" },
          status: 200,
        }),
      );
    } catch (error) {
      if (error instanceof DomainError) {
        const mapped = {
          NO_ACTIVE_EDITION: { message: "No Edition is currently accepting Ballots", status: 503 },
          POOL_NOT_READY: { message: "The active Candidate Pool is not ready", status: 503 },
          VISITOR_DISABLED: { message: "Visitor access is disabled", status: 403 },
        }[error.code];
        if (mapped) {
          return attachVisitorCookie(errorResponse(error.code, mapped.message, mapped.status));
        }
      }

      dependencies.onUnexpectedError?.(error);
      return attachVisitorCookie(
        errorResponse(
          "BALLOT_ISSUANCE_UNAVAILABLE",
          "Ballot issuance is temporarily unavailable",
          503,
        ),
      );
    }
  };
}
