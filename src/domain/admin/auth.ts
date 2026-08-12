import { createHmac, randomBytes } from "node:crypto";

import { argon2id, hash, verify } from "argon2";
import { and, eq, gt, isNull, lt } from "drizzle-orm";

import { adminSessions, adminUsers } from "../../db/schema/index.ts";
import { writeAdminAudit } from "../audit.ts";
import type { AppDatabase } from "../database.ts";
import { DomainError, requireDomainValue } from "../error.ts";

const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{1,48}[a-z0-9])?$/;
const dummyPasswordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$BwcHBwcHBwcHBwcHBwcHBw$ZvTNjDbU08pDr/tc34ShNYR3vZFKu5oGW3MEuFp/Zeg";

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export function adminSessionCookieOptions(expiresAt: Date) {
  return {
    expires: expiresAt,
    httpOnly: true as const,
    path: "/" as const,
    priority: "high" as const,
    sameSite: "strict" as const,
    secure: true as const,
  };
}

export function normalizeAdminUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!usernamePattern.test(username)) {
    throw new DomainError(
      "INVALID_ADMIN_USERNAME",
      "Username must be 3–50 lowercase letters, numbers, dots, underscores, or hyphens",
    );
  }
  return username;
}

export function validateAdminPassword(value: string): string {
  if (value.length < ADMIN_PASSWORD_MIN_LENGTH || value.length > 1024) {
    throw new DomainError(
      "INVALID_ADMIN_PASSWORD",
      `Password must be ${ADMIN_PASSWORD_MIN_LENGTH}–1024 characters`,
    );
  }
  return value;
}

export function hashAdminSessionToken(token: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(token, "utf8").digest();
}

export async function hashAdminPassword(password: string): Promise<string> {
  return hash(validateAdminPassword(password), {
    type: argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function createAdminUser(
  database: AppDatabase,
  input: { password: string; username: string },
) {
  const passwordHash = await hashAdminPassword(input.password);
  const [created] = await database
    .insert(adminUsers)
    .values({ passwordHash, username: normalizeAdminUsername(input.username) })
    .returning({ active: adminUsers.active, id: adminUsers.id, username: adminUsers.username });
  return requireDomainValue(created, "ADMIN_CREATE_FAILED", "Admin creation returned no row");
}

export interface AuthenticatedAdminSession {
  adminUserId: bigint;
  expiresAt: Date;
  sessionId: bigint;
  username: string;
}

export class AdminSessionService {
  private readonly database: AppDatabase;
  private readonly now: () => Date;
  private readonly secret: string;
  private readonly ttlHours: number;

  constructor(
    database: AppDatabase,
    secret: string,
    ttlHours = 12,
    now: () => Date = () => new Date(),
  ) {
    this.database = database;
    this.secret = secret;
    this.ttlHours = ttlHours;
    this.now = now;
  }

  async login(input: { password: string; username: string }): Promise<{
    expiresAt: Date;
    session: AuthenticatedAdminSession;
    token: string;
  }> {
    let username: string;
    try {
      username = normalizeAdminUsername(input.username);
    } catch {
      username = "__invalid__";
    }

    const [candidate] = await this.database
      .select({
        active: adminUsers.active,
        id: adminUsers.id,
        passwordHash: adminUsers.passwordHash,
        username: adminUsers.username,
      })
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    const passwordMatches = await verify(
      candidate?.passwordHash ?? dummyPasswordHash,
      input.password,
    );
    if (!candidate || !candidate.active || !passwordMatches) {
      throw new DomainError("INVALID_ADMIN_CREDENTIALS", "Invalid username or password");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashAdminSessionToken(token, this.secret);
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.ttlHours * 60 * 60 * 1_000);

    const session = await this.database.transaction(async (transaction) => {
      const [lockedAdmin] = await transaction
        .select({ active: adminUsers.active, id: adminUsers.id, username: adminUsers.username })
        .from(adminUsers)
        .where(eq(adminUsers.id, candidate.id))
        .for("update")
        .limit(1);
      if (!lockedAdmin?.active) {
        throw new DomainError("INVALID_ADMIN_CREDENTIALS", "Invalid username or password");
      }

      await transaction
        .update(adminSessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(adminSessions.adminUserId, lockedAdmin.id),
            isNull(adminSessions.revokedAt),
            lt(adminSessions.expiresAt, now),
          ),
        );

      const [created] = await transaction
        .insert(adminSessions)
        .values({
          adminUserId: lockedAdmin.id,
          createdAt: now,
          expiresAt,
          lastSeenAt: now,
          tokenHash,
        })
        .returning({ id: adminSessions.id });
      const createdSession = requireDomainValue(
        created,
        "ADMIN_SESSION_CREATE_FAILED",
        "Admin session creation returned no row",
      );

      await writeAdminAudit(transaction, {
        action: "ADMIN_LOGIN",
        actorAdminUserId: lockedAdmin.id,
        after: { expiresAt, sessionId: createdSession.id },
        reason: "Successful password authentication",
        targetId: createdSession.id.toString(),
        targetType: "ADMIN_SESSION",
      });

      return {
        adminUserId: lockedAdmin.id,
        expiresAt,
        sessionId: createdSession.id,
        username: lockedAdmin.username,
      };
    });

    return { expiresAt, session, token };
  }

  async authenticate(token: string | null | undefined): Promise<AuthenticatedAdminSession | null> {
    if (!token || token.length < 32 || token.length > 128) {
      return null;
    }

    const now = this.now();
    const [session] = await this.database
      .select({
        adminUserId: adminSessions.adminUserId,
        expiresAt: adminSessions.expiresAt,
        lastSeenAt: adminSessions.lastSeenAt,
        sessionId: adminSessions.id,
        username: adminUsers.username,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
      .where(
        and(
          eq(adminSessions.tokenHash, hashAdminSessionToken(token, this.secret)),
          gt(adminSessions.expiresAt, now),
          isNull(adminSessions.revokedAt),
          eq(adminUsers.active, true),
        ),
      )
      .limit(1);

    if (!session) {
      return null;
    }

    if (now.getTime() - session.lastSeenAt.getTime() >= 5 * 60 * 1_000) {
      await this.database
        .update(adminSessions)
        .set({ lastSeenAt: now })
        .where(eq(adminSessions.id, session.sessionId));
    }

    return {
      adminUserId: session.adminUserId,
      expiresAt: session.expiresAt,
      sessionId: session.sessionId,
      username: session.username,
    };
  }

  async logout(token: string | null | undefined): Promise<boolean> {
    if (!token) {
      return false;
    }

    const tokenHash = hashAdminSessionToken(token, this.secret);
    const now = this.now();
    return this.database.transaction(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.tokenHash, tokenHash))
        .for("update")
        .limit(1);
      if (!before || before.revokedAt) {
        return false;
      }

      await transaction
        .update(adminSessions)
        .set({ revokedAt: now })
        .where(eq(adminSessions.id, before.id));
      await writeAdminAudit(transaction, {
        action: "ADMIN_LOGOUT",
        actorAdminUserId: before.adminUserId,
        after: { revokedAt: now },
        before,
        reason: "Administrator requested logout",
        targetId: before.id.toString(),
        targetType: "ADMIN_SESSION",
      });
      return true;
    });
  }
}
