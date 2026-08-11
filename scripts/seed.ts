import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { seedDevelopmentData } from "../src/db/seed.ts";
import * as schema from "../src/db/schema/index.ts";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("The sample development seed cannot run in production");
}

const pool = new Pool({
  application_name: "cs-community-ranking-seed",
  connectionString: databaseUrl,
  max: 1,
});

try {
  await seedDevelopmentData(drizzle(pool, { schema }));
} finally {
  await pool.end();
}
