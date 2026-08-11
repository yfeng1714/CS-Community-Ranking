import { describe, expect, it, vi } from "vitest";

import { ActivePoolCache } from "@/domain/pool/active-pool-cache";

describe("ActivePoolCache", () => {
  it("loads once within its TTL and returns a stable snapshot", async () => {
    let now = 1_000;
    const cache = new ActivePoolCache(60_000, () => now);
    const loader = vi.fn(async () => [3n, 1n]);

    const first = await cache.get(9n, loader);
    now += 30_000;
    const second = await cache.get(9n, loader);

    expect(first).toEqual([3n, 1n]);
    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent misses", async () => {
    const cache = new ActivePoolCache(60_000);
    let release!: (ids: readonly bigint[]) => void;
    const loader = vi.fn(
      () =>
        new Promise<readonly bigint[]>((resolve) => {
          release = resolve;
        }),
    );

    const first = cache.get(4n, loader);
    const second = cache.get(4n, loader);
    release([1n, 2n]);

    await expect(first).resolves.toEqual([1n, 2n]);
    await expect(second).resolves.toEqual([1n, 2n]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads after explicit invalidation or expiry", async () => {
    let now = 0;
    const cache = new ActivePoolCache(10, () => now);
    const loader = vi
      .fn<() => Promise<readonly bigint[]>>()
      .mockResolvedValueOnce([1n])
      .mockResolvedValueOnce([2n])
      .mockResolvedValueOnce([3n]);

    await expect(cache.get(1n, loader)).resolves.toEqual([1n]);
    cache.invalidate(1n);
    await expect(cache.get(1n, loader)).resolves.toEqual([2n]);
    now = 11;
    await expect(cache.get(1n, loader)).resolves.toEqual([3n]);
  });

  it("does not let an invalidated in-flight load repopulate stale data", async () => {
    const cache = new ActivePoolCache(60_000);
    let releaseOld!: (ids: readonly bigint[]) => void;
    const oldLoad = cache.get(
      7n,
      () =>
        new Promise<readonly bigint[]>((resolve) => {
          releaseOld = resolve;
        }),
    );

    cache.invalidate(7n);
    await expect(cache.get(7n, async () => [2n])).resolves.toEqual([2n]);
    releaseOld([1n]);
    await expect(oldLoad).resolves.toEqual([1n]);
    await expect(cache.get(7n, async () => [3n])).resolves.toEqual([2n]);
  });
});
