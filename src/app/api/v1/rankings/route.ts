import { getDatabase } from "@/db/client";
import { getPublicRanking } from "@/domain/public/queries";
import { getLogger } from "@/observability/logger";

import { createRankingsHandler } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = createRankingsHandler({
  loadRanking: () => getPublicRanking(getDatabase()),
  onUnexpectedError(error) {
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[A-Z0-9_]{1,64}$/.test(error.code)
        ? error.code
        : "UNKNOWN";
    getLogger().error({ errorCode, event: "ranking_read_failed" }, "Public ranking read failed");
  },
});

export const GET = handler;
