import { z } from "zod";

import type { PublicPlayerProfile } from "@/domain/public/types";

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const PUBLIC_READ_CACHE = "public, max-age=30, stale-while-revalidate=90";

export function createPlayerHandler(dependencies: {
  loadPlayer(slug: string): Promise<PublicPlayerProfile | null>;
  onUnexpectedError?(error: unknown): void;
}) {
  return async function playerHandler(rawSlug: string): Promise<Response> {
    const slug = slugSchema.safeParse(rawSlug);
    if (!slug.success) {
      return Response.json(
        { error: { code: "INVALID_PLAYER_SLUG", message: "Player slug is invalid" } },
        { headers: { "cache-control": "no-store" }, status: 400 },
      );
    }

    try {
      const player = await dependencies.loadPlayer(slug.data);
      if (!player) {
        return Response.json(
          { error: { code: "PLAYER_NOT_FOUND", message: "Player was not found" } },
          { headers: { "cache-control": "no-store" }, status: 404 },
        );
      }
      return Response.json(player, { headers: { "cache-control": PUBLIC_READ_CACHE } });
    } catch (error) {
      dependencies.onUnexpectedError?.(error);
      return Response.json(
        {
          error: {
            code: "PLAYER_UNAVAILABLE",
            message: "Player profile is temporarily unavailable",
          },
        },
        { headers: { "cache-control": "no-store" }, status: 503 },
      );
    }
  };
}
