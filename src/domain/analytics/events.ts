import { eq } from "drizzle-orm";
import { z } from "zod";

import { editions, productEvents } from "@/db/schema";
import type { AppDatabase } from "@/domain/database";

export const productEventInputSchema = z
  .object({
    eventType: z.enum([
      "PAGE_VIEW",
      "RANKING_VIEW",
      "PLAYER_VIEW",
      "VOTE_RESULT_VIEW",
      "NEXT_CLICK",
      "SHARE_CLICK",
    ]),
    metadata: z
      .object({
        page: z.enum(["about", "player", "ranking", "vote"]).optional(),
        playerSlug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(100)
          .optional(),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.eventType === "PLAYER_VIEW" && !input.metadata.playerSlug) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "playerSlug"],
        message: "is required",
      });
    }
  });

export type ProductEventInput = z.infer<typeof productEventInputSchema>;

export async function recordProductEvent(
  database: AppDatabase,
  input: ProductEventInput & { visitorId: bigint | null },
): Promise<void> {
  const [edition] = await database
    .select({ id: editions.id })
    .from(editions)
    .where(eq(editions.status, "ACTIVE"))
    .limit(1);
  await database.insert(productEvents).values({
    editionId: edition?.id,
    eventType: input.eventType,
    metadata: input.metadata,
    visitorId: input.visitorId ?? undefined,
  });
}
