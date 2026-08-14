import path from "node:path";

import { count } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { bootstrapCanonicalManifest } from "@/domain/canonical/bootstrap";
import { loadCanonicalManifest, type CanonicalManifest } from "@/domain/canonical/manifest";
import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let database: NodePgDatabase<typeof schema>;
let actorAdminUserId: bigint;
let approvedManifest: CanonicalManifest;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  database = drizzle(testDatabase.pool, { schema });
  const [actor] = await database
    .insert(schema.adminUsers)
    .values({ passwordHash: "integration-only", username: "canonical-owner" })
    .returning({ id: schema.adminUsers.id });
  if (!actor) throw new Error("Failed to create canonical-bootstrap actor");
  actorAdminUserId = actor.id;

  approvedManifest = await loadCanonicalManifest(path.resolve("data/canonical/2026-beta.json"));
  approvedManifest.review = {
    approvedBy: "integration-test-owner",
    reviewedAt: "2026-08-14T12:00:00+08:00",
    status: "OWNER_APPROVED",
  };
});

afterAll(async () => {
  await dropTestDatabase(testDatabase);
});

describe("M10 canonical bootstrap", () => {
  it("atomically creates the DRAFT Edition, canonical identities, and five starters per Team", async () => {
    await expect(
      bootstrapCanonicalManifest(database, {
        actorAdminUserId,
        manifest: approvedManifest,
        reason: "Exercise reviewed canonical bootstrap",
      }),
    ).resolves.toEqual({ editionId: expect.any(String), players: 70, rosters: 70, teams: 14 });

    const [
      [editionCount],
      [teamCount],
      [playerCount],
      [rosterCount],
      [teamIdentityCount],
      [playerIdentityCount],
      [auditCount],
    ] = await Promise.all([
      database.select({ value: count() }).from(schema.editions),
      database.select({ value: count() }).from(schema.teams),
      database.select({ value: count() }).from(schema.players),
      database.select({ value: count() }).from(schema.rosterMemberships),
      database.select({ value: count() }).from(schema.teamExternalIdentities),
      database.select({ value: count() }).from(schema.playerExternalIdentities),
      database.select({ value: count() }).from(schema.adminAuditLogs),
    ]);
    expect({
      audits: auditCount?.value,
      editions: editionCount?.value,
      playerIdentities: playerIdentityCount?.value,
      players: playerCount?.value,
      rosters: rosterCount?.value,
      teamIdentities: teamIdentityCount?.value,
      teams: teamCount?.value,
    }).toEqual({
      audits: 239,
      editions: 1,
      playerIdentities: 70,
      players: 70,
      rosters: 70,
      teamIdentities: 14,
      teams: 14,
    });
    await expect(
      database.select({ status: schema.editions.status }).from(schema.editions),
    ).resolves.toEqual([{ status: "DRAFT" }]);
  });

  it("refuses a second bootstrap and preserves the first audited dataset", async () => {
    await expect(
      bootstrapCanonicalManifest(database, {
        actorAdminUserId,
        manifest: approvedManifest,
        reason: "Must not layer canonical data over existing rows",
      }),
    ).rejects.toMatchObject({ code: "CANONICAL_BOOTSTRAP_REQUIRES_EMPTY_DATABASE" });
    await expect(database.select({ value: count() }).from(schema.players)).resolves.toEqual([
      { value: 70 },
    ]);
  });
});
