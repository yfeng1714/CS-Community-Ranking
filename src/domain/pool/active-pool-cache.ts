import { DomainError } from "../error.ts";

interface CacheEntry {
  expiresAt: number;
  playerIds: readonly bigint[];
}

export type ActivePoolLoader = (editionId: bigint) => Promise<readonly bigint[]>;

export class ActivePoolCache {
  private clearVersion = 0;
  private readonly entries = new Map<bigint, CacheEntry>();
  private readonly editionVersions = new Map<bigint, number>();
  private readonly pendingLoads = new Map<bigint, Promise<readonly bigint[]>>();
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(ttlMs: number, now: () => number = Date.now) {
    if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
      throw new DomainError("INVALID_CACHE_TTL", "Active Pool cache TTL must be positive");
    }

    this.ttlMs = ttlMs;
    this.now = now;
  }

  async get(editionId: bigint, loader: ActivePoolLoader): Promise<readonly bigint[]> {
    const cached = this.entries.get(editionId);
    if (cached && cached.expiresAt > this.now()) {
      return cached.playerIds;
    }

    const pending = this.pendingLoads.get(editionId);
    if (pending) {
      return pending;
    }

    const clearVersion = this.clearVersion;
    const editionVersion = this.editionVersions.get(editionId) ?? 0;
    const load = loader(editionId)
      .then((playerIds) => {
        const stablePlayerIds = Object.freeze([...playerIds]);
        if (
          this.clearVersion === clearVersion &&
          (this.editionVersions.get(editionId) ?? 0) === editionVersion
        ) {
          this.entries.set(editionId, {
            expiresAt: this.now() + this.ttlMs,
            playerIds: stablePlayerIds,
          });
        }
        return stablePlayerIds;
      })
      .finally(() => {
        if (this.pendingLoads.get(editionId) === load) {
          this.pendingLoads.delete(editionId);
        }
      });

    this.pendingLoads.set(editionId, load);
    return load;
  }

  invalidate(editionId: bigint): void {
    this.entries.delete(editionId);
    this.pendingLoads.delete(editionId);
    this.editionVersions.set(editionId, (this.editionVersions.get(editionId) ?? 0) + 1);
  }

  clear(): void {
    this.clearVersion += 1;
    this.entries.clear();
    this.pendingLoads.clear();
  }
}
