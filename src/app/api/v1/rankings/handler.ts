import type { PublicRanking } from "@/domain/public/types";

const PUBLIC_READ_CACHE = "public, max-age=15, stale-while-revalidate=45";

export function createRankingsHandler(dependencies: {
  loadRanking(): Promise<PublicRanking>;
  onUnexpectedError?(error: unknown): void;
}) {
  return async function rankingsHandler(): Promise<Response> {
    try {
      return Response.json(await dependencies.loadRanking(), {
        headers: { "cache-control": PUBLIC_READ_CACHE },
      });
    } catch (error) {
      dependencies.onUnexpectedError?.(error);
      return Response.json(
        { error: { code: "RANKING_UNAVAILABLE", message: "Ranking is temporarily unavailable" } },
        { headers: { "cache-control": "no-store" }, status: 503 },
      );
    }
  };
}
