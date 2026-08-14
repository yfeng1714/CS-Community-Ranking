import path from "node:path";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getEnv } from "../src/config/env.ts";
import { closeDatabasePool, getDatabase } from "../src/db/client.ts";
import { adminUsers } from "../src/db/schema/index.ts";
import { hashAdminPassword } from "../src/domain/admin/auth.ts";

const env = getEnv();
if (env.NODE_ENV === "production") {
  throw new Error("E2E fixtures must never be provisioned in production");
}

const database = getDatabase();
await migrate(database, { migrationsFolder: path.resolve("drizzle") });

const passwordHash = await hashAdminPassword("playwright-only-password");
const [existing] = await database
  .select({ id: adminUsers.id })
  .from(adminUsers)
  .where(eq(adminUsers.username, "e2e-owner"))
  .limit(1);

if (existing) {
  await database
    .update(adminUsers)
    .set({ active: true, passwordHash, updatedAt: new Date() })
    .where(eq(adminUsers.id, existing.id));
} else {
  await database.insert(adminUsers).values({ passwordHash, username: "e2e-owner" });
}

await closeDatabasePool();
