interface RateLimitEntry {
  count: number;
  windowEndsAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class BoundedFixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly limit: number,
    private readonly maximumKeys: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {
    if (
      !Number.isInteger(limit) ||
      limit <= 0 ||
      !Number.isInteger(maximumKeys) ||
      maximumKeys <= 0 ||
      windowMs <= 0
    ) {
      throw new Error("Rate limiter bounds must be positive");
    }
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    const current = this.entries.get(key);

    if (!current || current.windowEndsAt <= now) {
      this.entries.delete(key);
      this.makeRoom(now);
      this.entries.set(key, { count: 1, windowEndsAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    this.entries.delete(key);
    this.entries.set(key, current);
    if (current.count >= this.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.windowEndsAt - now) / 1_000)),
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  get size(): number {
    return this.entries.size;
  }

  private makeRoom(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.windowEndsAt <= now) {
        this.entries.delete(key);
      }
    }

    while (this.entries.size >= this.maximumKeys) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }
}
