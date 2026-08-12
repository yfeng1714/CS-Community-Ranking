import { getDatabase } from "@/db/client";
import { getEnv } from "@/config/env";
import { getPublicPlayer } from "@/domain/public/queries";
import { getLogger } from "@/observability/logger";
import { getPublicRiskMonitor } from "@/security/runtime";

import { createPlayerHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = createPlayerHandler({
  loadPlayer: (slug) =>
    getPublicPlayer(getDatabase(), slug, new Date(), getEnv().EXTERNAL_STATS_STALE_AFTER_HOURS),
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
      { errorCode, event: "player_profile_read_failed" },
      "Public player profile read failed",
    );
  },
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const limit = getPublicRiskMonitor().inspect(request.headers).infrastructureLimit;
  if (limit && !limit.allowed) {
    return Response.json(
      { error: { code: "INFRASTRUCTURE_RATE_LIMITED", message: "Request rate limited" } },
      { headers: { "retry-after": limit.retryAfterSeconds.toString() }, status: 429 },
    );
  }
  const { slug } = await context.params;
  return handler(slug);
}
