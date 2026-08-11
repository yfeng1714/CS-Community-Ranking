import { checkDatabaseReadiness } from "@/db/client";
import { getLogger } from "@/observability/logger";

import { createReadinessHandler } from "./health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{1,64}$/.test(error.code)
  ) {
    return error.code;
  }

  return "UNKNOWN";
}

export const GET = createReadinessHandler({
  checkDatabase: checkDatabaseReadiness,
  onFailure(error) {
    getLogger().warn(
      {
        event: "readiness_check_failed",
        errorCode: safeErrorCode(error),
      },
      "PostgreSQL readiness check failed",
    );
  },
});
