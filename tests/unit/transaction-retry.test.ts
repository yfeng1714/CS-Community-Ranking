import { describe, expect, it, vi } from "vitest";

import { withTransactionRetry } from "@/domain/ballots/retry";

describe("withTransactionRetry", () => {
  it("retries serialization failures and deadlocks with a bounded attempt count", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: "40001" })
      .mockRejectedValueOnce({ cause: { code: "40P01" } })
      .mockResolvedValue("ok");
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(
      withTransactionRetry(operation, { pause, random: () => 0, maxAttempts: 3 }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("does not retry ordinary database errors", async () => {
    const error = { code: "23514" };
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withTransactionRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
  });
});
