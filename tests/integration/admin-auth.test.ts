import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { AdminSessionService, createAdminUser } from "@/domain/admin/auth";
import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
});

afterAll(async () => {
  await dropTestDatabase(testDatabase);
});

describe("Milestone 6 admin sessions", () => {
  it("creates an opaque database session, authenticates it, and revokes it with audit evidence", async () => {
    const admin = await createAdminUser(database, {
      password: "correct horse battery staple",
      username: "Owner.Admin",
    });
    let now = new Date("2040-01-01T00:00:00.000Z");
    const service = new AdminSessionService(database, "s".repeat(32), 12, () => now);

    await expect(
      service.login({ password: "wrong password", username: "owner.admin" }),
    ).rejects.toMatchObject({ code: "INVALID_ADMIN_CREDENTIALS" });

    const login = await service.login({
      password: "correct horse battery staple",
      username: "owner.admin",
    });
    expect(login.token).toHaveLength(43);
    expect(login.session).toMatchObject({ adminUserId: admin.id, username: "owner.admin" });
    await expect(service.authenticate(login.token)).resolves.toMatchObject({
      adminUserId: admin.id,
      sessionId: login.session.sessionId,
    });

    const [stored] = await database
      .select()
      .from(schema.adminSessions)
      .where(eq(schema.adminSessions.id, login.session.sessionId));
    expect(stored?.tokenHash.toString("utf8")).not.toContain(login.token);

    await expect(service.logout(login.token)).resolves.toBe(true);
    await expect(service.authenticate(login.token)).resolves.toBeNull();
    const audit = await database
      .select({ action: schema.adminAuditLogs.action })
      .from(schema.adminAuditLogs)
      .where(eq(schema.adminAuditLogs.actorAdminUserId, admin.id));
    expect(audit.map((row) => row.action)).toEqual(["ADMIN_LOGIN", "ADMIN_LOGOUT"]);

    now = new Date("2040-01-02T00:00:00.000Z");
    await expect(service.authenticate(login.token)).resolves.toBeNull();
  });

  it("rejects sessions immediately when their admin is made inactive", async () => {
    const admin = await createAdminUser(database, {
      password: "another correct horse password",
      username: "inactive-owner",
    });
    const service = new AdminSessionService(database, "x".repeat(32));
    const login = await service.login({
      password: "another correct horse password",
      username: admin.username,
    });
    await database
      .update(schema.adminUsers)
      .set({ active: false })
      .where(eq(schema.adminUsers.id, admin.id));
    await expect(service.authenticate(login.token)).resolves.toBeNull();
    await expect(
      service.login({ password: "another correct horse password", username: admin.username }),
    ).rejects.toMatchObject({ code: "INVALID_ADMIN_CREDENTIALS" });
  });
});
