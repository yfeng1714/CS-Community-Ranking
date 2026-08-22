import { describe, expect, it } from "vitest";
import { getTableName, is, Table } from "drizzle-orm";

import { criticalTables, databaseIdentity, postgresCommand } from "../../scripts/backup-support.ts";
import * as schema from "../../src/db/schema/index.ts";

describe("backup connection handling", () => {
  it("passes credentials through the environment instead of command arguments", () => {
    const command = postgresCommand("postgresql://operator:secret@db.internal:5433/ranking");

    expect(command.args).toEqual([
      "--host",
      "db.internal",
      "--port",
      "5433",
      "--username",
      "operator",
      "--dbname",
      "ranking",
    ]);
    expect(command.args).not.toContain("secret");
    expect(command.env.PGPASSWORD).toBe("secret");
  });

  it("compares database identity without credentials", () => {
    expect(databaseIdentity("postgresql://operator:secret@db.internal/ranking")).toBe(
      "db.internal:5432/ranking",
    );
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() => postgresCommand("https://db.internal/ranking")).toThrow(
      "must use postgres:// or postgresql://",
    );
  });

  it("keeps the backup manifest table list synchronized with the application schema", () => {
    const schemaTables = Object.values(schema)
      .flatMap((value) => (is(value, Table) ? [getTableName(value as Table)] : []))
      .sort();

    expect([...criticalTables].sort()).toEqual(schemaTables);
  });
});
