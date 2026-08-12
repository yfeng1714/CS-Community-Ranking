import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { VoteResolutionService } from "@/domain/votes/resolution";
import { DomainError } from "@/domain/error";
import type { VisitorIdentityService } from "@/domain/visitors/service";
import { visitorCookieOptions } from "@/domain/visitors/service";
import type { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { mutationRejectionResponse, validateMutationRequest } from "@/security/mutation-request";

const publicBallotIdSchema = z.uuid();
const resolveBodySchema = z.object({ choice: z.enum(["LEFT", "RIGHT", "SKIP"]) }).strict();

interface ResolveBallotHandlerDependencies {
  appOrigin: string;
  onUnexpectedError?(error: unknown): void;
  production: boolean;
  rateLimiter: Pick<BoundedFixedWindowRateLimiter, "check">;
  resolution: Pick<VoteResolutionService, "resolve">;
  visitorCookieMaxAgeDays: number;
  visitorCookieName: string;
  visitors: Pick<VisitorIdentityService, "resolve">;
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Readonly<Record<string, unknown>>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ?? {}) } },
    { headers: { "cache-control": "no-store" }, status },
  );
}

export function createResolveBallotHandler(dependencies: ResolveBallotHandlerDependencies) {
  return async function resolveBallotHandler(
    request: NextRequest,
    rawPublicBallotId: string,
  ): Promise<Response> {
    const guard = validateMutationRequest(request, {
      appOrigin: dependencies.appOrigin,
      production: dependencies.production,
    });
    if (!guard.ok) {
      return mutationRejectionResponse(guard);
    }

    const publicBallotId = publicBallotIdSchema.safeParse(rawPublicBallotId);
    if (!publicBallotId.success) {
      return errorResponse("INVALID_BALLOT_ID", "Ballot ID must be a UUID", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
    }
    const parsedBody = resolveBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return errorResponse("INVALID_RESOLUTION_CHOICE", "Choice must be LEFT, RIGHT, or SKIP", 400);
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
      const rateLimit = dependencies.rateLimiter.check(visitor.id.toString());
      if (!rateLimit.allowed) {
        const response = errorResponse(
          "INFRASTRUCTURE_RATE_LIMITED",
          "Too many resolution requests; retry shortly",
          429,
        );
        response.headers.set("retry-after", rateLimit.retryAfterSeconds.toString());
        return attachVisitorCookie(response);
      }

      return attachVisitorCookie(
        NextResponse.json(
          await dependencies.resolution.resolve({
            choice: parsedBody.data.choice,
            publicBallotId: publicBallotId.data,
            visitorId: visitor.id,
          }),
          { headers: { "cache-control": "no-store" }, status: 200 },
        ),
      );
    } catch (error) {
      if (error instanceof DomainError) {
        const mapped = {
          BALLOT_ALREADY_RESOLVED: {
            message: "Ballot was already resolved with a different choice",
            status: 409,
          },
          BALLOT_EXPIRED: { message: "Ballot has expired", status: 410 },
          BALLOT_NOT_FOUND: { message: "Ballot was not found", status: 404 },
          EDITION_NOT_ACTIVE: { message: "The Ballot's Edition is not active", status: 409 },
          VISITOR_DISABLED: { message: "Visitor access is disabled", status: 403 },
        }[error.code];
        if (mapped) {
          return attachVisitorCookie(
            errorResponse(error.code, mapped.message, mapped.status, error.details),
          );
        }
      }

      dependencies.onUnexpectedError?.(error);
      return attachVisitorCookie(
        errorResponse(
          "BALLOT_RESOLUTION_UNAVAILABLE",
          "Ballot resolution is temporarily unavailable",
          503,
        ),
      );
    }
  };
}
