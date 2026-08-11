import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema/index.ts";

export type AppDatabase = NodePgDatabase<typeof schema>;
export type AppTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
