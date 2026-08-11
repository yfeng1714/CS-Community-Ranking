import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import * as schema from "@/db/schema";

const TEST_DATABASE_NAME = "csr_m1_test";

export interface TestDatabase {
  pool: Pool;
}

function getUrls(): { adminUrl: string; testUrl: string } {
  const configuredUrl = process.env.DATABASE_URL;

  if (!configuredUrl) {
    throw new Error("DATABASE_URL is required for integration tests");
  }

  const adminUrl = new URL(configuredUrl);
  const testUrl = new URL(configuredUrl);
  adminUrl.pathname = "/postgres";
  testUrl.pathname = `/${TEST_DATABASE_NAME}`;

  return { adminUrl: adminUrl.toString(), testUrl: testUrl.toString() };
}

async function withAdminPool(operation: (pool: Pool) => Promise<void>): Promise<void> {
  const { adminUrl } = getUrls();
  const pool = new Pool({
    application_name: "cs-community-ranking-test-lifecycle",
    connectionString: adminUrl,
    max: 1,
  });

  try {
    await operation(pool);
  } finally {
    await pool.end();
  }
}

export async function createTestDatabase(): Promise<TestDatabase> {
  await withAdminPool(async (pool) => {
    await pool.query(`drop database if exists ${TEST_DATABASE_NAME} with (force)`);
    await pool.query(`create database ${TEST_DATABASE_NAME} template template0 encoding 'UTF8'`);
  });

  const { testUrl } = getUrls();
  const pool = new Pool({
    application_name: "cs-community-ranking-integration",
    connectionString: testUrl,
    max: 4,
  });

  try {
    await migrate(drizzle(pool, { schema }), {
      migrationsFolder: path.resolve("drizzle"),
    });
  } catch (error) {
    await pool.end();
    await dropTestDatabase();
    throw error;
  }

  return { pool };
}

export async function dropTestDatabase(database?: TestDatabase): Promise<void> {
  await database?.pool.end();
  await withAdminPool(async (pool) => {
    await pool.query(`drop database if exists ${TEST_DATABASE_NAME} with (force)`);
  });
}
