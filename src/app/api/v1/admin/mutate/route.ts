import type { NextRequest } from "next/server";

import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";
import { getAdminSessionService } from "@/domain/admin/runtime";
import { getRuntimeCandidatePoolService } from "@/domain/pool/runtime";
import { getLogger } from "@/observability/logger";

import { createAdminMutationHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let handler: ReturnType<typeof createAdminMutationHandler> | undefined;

export function POST(request: NextRequest): Promise<Response> {
  handler ??= createAdminMutationHandler({
    database: getDatabase(),
    env: getEnv(),
    onUnexpectedError(error) {
      getLogger().error({ err: error, event: "admin_mutation_failed" }, "Admin mutation failed");
    },
    pool: getRuntimeCandidatePoolService(),
    sessions: getAdminSessionService(),
  });
  return handler(request);
}
