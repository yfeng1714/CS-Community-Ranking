import { createHmac, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { anonymousVisitors } from "../../db/schema/index.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue } from "../error.ts";
import { findPostgreSqlErrorCode } from "../ballots/retry.ts";

const VISITOR_TOKEN_BYTES = 32;
const VISITOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface ResolvedVisitor {
  created: boolean;
  id: bigint;
  tokenToSet?: string;
}

export function createVisitorToken(): string {
  return randomBytes(VISITOR_TOKEN_BYTES).toString("base64url");
}

export function isValidVisitorToken(token: string | undefined): token is string {
  return typeof token === "string" && VISITOR_TOKEN_PATTERN.test(token);
}

export function hashVisitorToken(token: string, pepper: string): Buffer {
  return createHmac("sha256", pepper).update(token, "utf8").digest();
}

export function visitorCookieOptions(maxAgeDays: number): {
  httpOnly: true;
  maxAge: number;
  path: "/";
  sameSite: "lax";
  secure: true;
} {
  return {
    httpOnly: true,
    maxAge: maxAgeDays * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: true,
  };
}

export class VisitorIdentityService {
  constructor(
    private readonly database: AppDatabase,
    private readonly pepper: string,
    private readonly now: () => Date = () => new Date(),
    private readonly tokenFactory: () => string = createVisitorToken,
  ) {}

  async resolve(cookieToken: string | undefined): Promise<ResolvedVisitor> {
    const existing = await this.find(cookieToken);
    if (existing) return { created: false, id: existing.id };

    return this.createVisitor();
  }

  async find(cookieToken: string | undefined): Promise<{ id: bigint } | null> {
    if (isValidVisitorToken(cookieToken)) {
      const [visitor] = await this.database
        .select({ disabledAt: anonymousVisitors.disabledAt, id: anonymousVisitors.id })
        .from(anonymousVisitors)
        .where(eq(anonymousVisitors.tokenHash, hashVisitorToken(cookieToken, this.pepper)))
        .limit(1);

      if (visitor) {
        if (visitor.disabledAt) {
          throw new DomainError("VISITOR_DISABLED", "Visitor access is disabled");
        }

        await this.database
          .update(anonymousVisitors)
          .set({ lastSeenAt: this.now() })
          .where(eq(anonymousVisitors.id, visitor.id));
        return { id: visitor.id };
      }
    }
    return null;
  }

  private async createVisitor(): Promise<ResolvedVisitor> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = this.tokenFactory();
      if (!isValidVisitorToken(token)) {
        throw new DomainError(
          "VISITOR_TOKEN_GENERATION_FAILED",
          "Generated visitor token is invalid",
        );
      }

      try {
        const [visitor] = await this.database
          .insert(anonymousVisitors)
          .values({ tokenHash: hashVisitorToken(token, this.pepper) })
          .returning({ id: anonymousVisitors.id });
        return {
          created: true,
          id: requireDomainValue(
            visitor,
            "VISITOR_CREATE_FAILED",
            "Visitor insertion returned no row",
          ).id,
          tokenToSet: token,
        };
      } catch (error) {
        if (findPostgreSqlErrorCode(error) !== "23505") {
          throw error;
        }
      }
    }

    throw new DomainError("VISITOR_CREATE_FAILED", "Could not allocate a unique visitor token");
  }
}
