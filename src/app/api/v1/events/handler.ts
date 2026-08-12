import type { NextRequest } from "next/server";

import { productEventInputSchema, type ProductEventInput } from "@/domain/analytics/events";
import type { VisitorIdentityService } from "@/domain/visitors/service";
import type { BoundedFixedWindowRateLimiter } from "@/security/rate-limiter";
import { mutationRejectionResponse, validateMutationRequest } from "@/security/mutation-request";
import type { PublicRiskMonitorLike } from "@/security/risk-monitor";

const ROUTE = "/api/v1/events";

export function createProductEventHandler(dependencies: {
  appOrigin: string;
  onUnexpectedError?(error: unknown): void;
  production: boolean;
  rateLimiter: Pick<BoundedFixedWindowRateLimiter, "check">;
  recordEvent(input: ProductEventInput & { visitorId: bigint | null }): Promise<void>;
  riskMonitor: PublicRiskMonitorLike;
  visitorCookieName: string;
  visitors: Pick<VisitorIdentityService, "find">;
}) {
  return async function productEventHandler(request: NextRequest): Promise<Response> {
    const inspection = dependencies.riskMonitor.inspect(request.headers);
    if (inspection.infrastructureLimit && !inspection.infrastructureLimit.allowed) {
      return new Response(null, { status: 202 });
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
      return Response.json(
        { error: { code: "INVALID_JSON", message: "Invalid event" } },
        { headers: { "cache-control": "no-store" }, status: 400 },
      );
    }
    const parsed = productEventInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "INVALID_PRODUCT_EVENT", message: "Invalid event" } },
        { headers: { "cache-control": "no-store" }, status: 400 },
      );
    }

    try {
      const visitor = await dependencies.visitors.find(
        request.cookies.get(dependencies.visitorCookieName)?.value,
      );
      if (visitor) {
        await dependencies.riskMonitor.assess({
          inspection,
          route: ROUTE,
          visitorCreated: false,
          visitorId: visitor.id,
        });
      }
      if (!dependencies.rateLimiter.check(visitor?.id.toString() ?? "unattributed").allowed) {
        return new Response(null, { status: 204 });
      }
      await dependencies.recordEvent({ ...parsed.data, visitorId: visitor?.id ?? null });
      return new Response(null, { status: 204 });
    } catch (error) {
      dependencies.onUnexpectedError?.(error);
      return new Response(null, { status: 202 });
    }
  };
}
