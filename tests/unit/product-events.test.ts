import { describe, expect, it } from "vitest";

import { productEventInputSchema } from "@/domain/analytics/events";

describe("product event input", () => {
  it("accepts only allowlisted event types and bounded metadata", () => {
    expect(
      productEventInputSchema.safeParse({
        eventType: "PLAYER_VIEW",
        metadata: { page: "player", playerSlug: "sample-ace" },
      }).success,
    ).toBe(true);
    expect(
      productEventInputSchema.safeParse({
        eventType: "VOTE_RESULT_VIEW",
        metadata: { choice: "LEFT" },
      }).success,
    ).toBe(false);
    expect(productEventInputSchema.safeParse({ eventType: "CUSTOM", metadata: {} }).success).toBe(
      false,
    );
  });
});
