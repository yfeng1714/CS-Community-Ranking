import { describe, expect, it } from "vitest";

import { databaseIdentity, postgresCommand } from "../../scripts/backup-support.ts";

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
});
