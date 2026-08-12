import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool, QueryResult } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedDevelopmentData } from "@/db/seed";
import * as schema from "@/db/schema";

import { createTestDatabase, dropTestDatabase, type TestDatabase } from "./helpers/database";

interface FixtureIds {
  adminId: string;
  draftEditionId: string;
  player1Id: string;
  player2Id: string;
  player3Id: string;
  team1Id: string;
  team2Id: string;
  visitorId: string;
}

interface PostgreSqlError extends Error {
  code?: string;
  constraint?: string;
}

let testDatabase: TestDatabase;
let pool: Pool;
let fixture: FixtureIds;

function firstId(result: QueryResult<{ id: string }>, label: string): string {
  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error(`Missing fixture id for ${label}`);
  }

  return id;
}

async function expectConstraintViolation(
  operation: () => Promise<unknown>,
  expectedConstraint: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const databaseError = error as PostgreSqlError;
    expect(["23505", "23514"]).toContain(databaseError.code);
    expect(databaseError.constraint).toBe(expectedConstraint);
    return;
  }

  throw new Error(`Expected PostgreSQL constraint ${expectedConstraint} to reject the operation`);
}

async function insertBaseFixture(): Promise<FixtureIds> {
  const adminId = firstId(
    await pool.query<{ id: string }>(
      `insert into admin_user (username, password_hash, active)
       values ('integration-admin', 'disabled-integration-hash', false)
       returning id`,
    ),
    "admin",
  );

  const team1Id = firstId(
    await pool.query<{ id: string }>(
      `insert into team (slug, name) values ('integration-alpha', 'Integration Alpha') returning id`,
    ),
    "team 1",
  );
  const team2Id = firstId(
    await pool.query<{ id: string }>(
      `insert into team (slug, name) values ('integration-bravo', 'Integration Bravo') returning id`,
    ),
    "team 2",
  );

  const playerIds: string[] = [];
  for (const [slug, nickname] of [
    ["integration-one", "One"],
    ["integration-two", "Two"],
    ["integration-three", "Three"],
  ] as const) {
    playerIds.push(
      firstId(
        await pool.query<{ id: string }>(
          `insert into player (slug, nickname, professional_status)
           values ($1, $2, 'ACTIVE') returning id`,
          [slug, nickname],
        ),
        slug,
      ),
    );
  }

  const draftEditionId = firstId(
    await pool.query<{ id: string }>(
      `insert into edition (code, name, status, starts_at, ends_at)
       values ('integration-draft', 'Integration Draft', 'DRAFT', '2026-01-01', '2027-01-01')
       returning id`,
    ),
    "draft Edition",
  );

  const visitorId = firstId(
    await pool.query<{ id: string }>(
      `insert into anonymous_visitor (token_hash) values (decode('01020304', 'hex')) returning id`,
    ),
    "visitor",
  );

  const [player1Id, player2Id, player3Id] = playerIds;
  if (!player1Id || !player2Id || !player3Id) {
    throw new Error("Expected three fixture players");
  }

  return {
    adminId,
    draftEditionId,
    player1Id,
    player2Id,
    player3Id,
    team1Id,
    team2Id,
    visitorId,
  };
}

describe("Milestone 1 PostgreSQL schema", () => {
  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    pool = testDatabase.pool;
    fixture = await insertBaseFixture();
  }, 30_000);

  afterAll(async () => {
    await dropTestDatabase(testDatabase);
  });

  it("migrates the complete V0.1 table and enum set into an empty database", async () => {
    const tables = await pool.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    const enums = await pool.query<{ typname: string }>(
      `select typname
       from pg_type
       where typtype = 'e' and typnamespace = 'public'::regnamespace
       order by typname`,
    );

    expect(tables.rows).toHaveLength(29);
    expect(enums.rows).toHaveLength(21);
    expect(tables.rows.map((row) => row.table_name)).toContain("pending_import_change");
    expect(tables.rows.map((row) => row.table_name)).toContain("admin_audit_log");
    expect(tables.rows.map((row) => row.table_name)).toContain("risk_observation");
    expect(tables.rows.map((row) => row.table_name)).toContain("api_request_metric");
  });

  it("allows at most one active Edition", async () => {
    const firstActive = await pool.query<{ id: string }>(
      `insert into edition (code, name, status, starts_at, ends_at)
       values ('integration-active-1', 'Active One', 'ACTIVE', '2026-01-01', '2027-01-01')
       returning id`,
    );

    try {
      await expectConstraintViolation(
        () =>
          pool.query(
            `insert into edition (code, name, status, starts_at, ends_at)
             values ('integration-active-2', 'Active Two', 'ACTIVE', '2026-01-01', '2027-01-01')`,
          ),
        "edition_single_active",
      );
    } finally {
      await pool.query(`delete from edition where id = $1`, [
        firstId(firstActive, "active Edition"),
      ]);
    }
  });

  it("allows only one current roster membership per player", async () => {
    const currentRoster = await pool.query<{ id: string }>(
      `insert into roster_membership (player_id, team_id, status, starts_at, source)
       values ($1, $2, 'STARTER', '2026-01-01', 'integration-test') returning id`,
      [fixture.player1Id, fixture.team1Id],
    );

    try {
      await expectConstraintViolation(
        () =>
          pool.query(
            `insert into roster_membership (player_id, team_id, status, starts_at, source)
             values ($1, $2, 'BENCH', '2026-02-01', 'integration-test')`,
            [fixture.player1Id, fixture.team2Id],
          ),
        "roster_one_current_per_player",
      );
    } finally {
      await pool.query(`delete from roster_membership where id = $1`, [
        firstId(currentRoster, "roster membership"),
      ]);
    }
  });

  it("enforces ranking score and non-negative counters", async () => {
    await expectConstraintViolation(
      () =>
        pool.query(
          `insert into player_ranking (edition_id, player_id, score, wins, losses, skips)
           values ($1, $2, 2, 1, 0, 0)`,
          [fixture.draftEditionId, fixture.player1Id],
        ),
      "player_ranking_score_matches_record",
    );

    await expectConstraintViolation(
      () =>
        pool.query(
          `insert into player_ranking (edition_id, player_id, score, wins, losses, skips)
           values ($1, $2, -1, 0, 1, -1)`,
          [fixture.draftEditionId, fixture.player1Id],
        ),
      "player_ranking_skips_nonnegative",
    );
  });

  it("enforces canonical pairs and counted-within-observed counters", async () => {
    await expectConstraintViolation(
      () =>
        pool.query(
          `insert into pair_aggregate (edition_id, player_1_id, player_2_id)
           values ($1, $2, $3)`,
          [fixture.draftEditionId, fixture.player2Id, fixture.player1Id],
        ),
      "pair_aggregate_canonical_pair",
    );

    await expectConstraintViolation(
      () =>
        pool.query(
          `insert into pair_aggregate (
             edition_id, player_1_id, player_2_id,
             counted_player_1_wins, observed_player_1_choices
           ) values ($1, $2, $3, 2, 1)`,
          [fixture.draftEditionId, fixture.player1Id, fixture.player2Id],
        ),
      "pair_counted_p1_within_observed",
    );
  });

  it("rejects a second open Ballot for the same visitor and Edition", async () => {
    const firstBallot = await pool.query<{ id: string }>(
      `insert into ballot (
         edition_id, visitor_id, player_1_id, player_2_id, left_player_id, right_player_id,
         expires_at, usage_date, ranking_eligibility, daily_ordinal
       ) values ($1, $2, $3, $4, $3, $4, now() + interval '30 minutes', '2026-08-11', 'ELIGIBLE', 1)
       returning id`,
      [fixture.draftEditionId, fixture.visitorId, fixture.player1Id, fixture.player2Id],
    );

    try {
      await expectConstraintViolation(
        () =>
          pool.query(
            `insert into ballot (
               edition_id, visitor_id, player_1_id, player_2_id, left_player_id, right_player_id,
               expires_at, usage_date, ranking_eligibility, daily_ordinal
             ) values ($1, $2, $3, $4, $4, $3, now() + interval '30 minutes', '2026-08-11', 'ELIGIBLE', 2)`,
            [fixture.draftEditionId, fixture.visitorId, fixture.player1Id, fixture.player3Id],
          ),
        "ballot_one_open_per_visitor_edition",
      );
    } finally {
      await pool.query(`delete from ballot where id = $1`, [firstId(firstBallot, "open Ballot")]);
    }
  });

  it("enforces Ballot lifecycle state shape", async () => {
    await expectConstraintViolation(
      () =>
        pool.query(
          `insert into ballot (
             edition_id, visitor_id, player_1_id, player_2_id, left_player_id, right_player_id,
             expires_at, usage_date, status, ranking_eligibility, daily_ordinal
           ) values ($1, $2, $3, $4, $3, $4, now() + interval '30 minutes', '2026-08-12', 'RESOLVED', 'ELIGIBLE', 1)`,
          [fixture.draftEditionId, fixture.visitorId, fixture.player1Id, fixture.player2Id],
        ),
      "ballot_resolution_state",
    );
  });

  it("allows at most one Vote per Ballot", async () => {
    const ballot = await pool.query<{ id: string }>(
      `insert into ballot (
         edition_id, visitor_id, player_1_id, player_2_id, left_player_id, right_player_id,
         expires_at, usage_date, ranking_eligibility, daily_ordinal
       ) values ($1, $2, $3, $4, $3, $4, now() + interval '30 minutes', '2026-08-13', 'ELIGIBLE', 1)
       returning id`,
      [fixture.draftEditionId, fixture.visitorId, fixture.player1Id, fixture.player2Id],
    );
    const ballotId = firstId(ballot, "Vote Ballot");

    try {
      await pool.query(
        `insert into vote (ballot_id, edition_id, visitor_id, choice, status)
         values ($1, $2, $3, 'SKIP', 'VALID')`,
        [ballotId, fixture.draftEditionId, fixture.visitorId],
      );
      await expectConstraintViolation(
        () =>
          pool.query(
            `insert into vote (ballot_id, edition_id, visitor_id, choice, status)
             values ($1, $2, $3, 'SKIP', 'THROTTLED')`,
            [ballotId, fixture.draftEditionId, fixture.visitorId],
          ),
        "vote_ballot_unique",
      );
    } finally {
      await pool.query(`delete from vote where ballot_id = $1`, [ballotId]);
      await pool.query(`delete from ballot where id = $1`, [ballotId]);
    }
  });

  it("enforces Vote choice and winner/loser shape", async () => {
    const ballot = await pool.query<{ id: string }>(
      `insert into ballot (
         edition_id, visitor_id, player_1_id, player_2_id, left_player_id, right_player_id,
         expires_at, usage_date, ranking_eligibility, daily_ordinal
       ) values ($1, $2, $3, $4, $3, $4, now() + interval '30 minutes', '2026-08-14', 'ELIGIBLE', 1)
       returning id`,
      [fixture.draftEditionId, fixture.visitorId, fixture.player1Id, fixture.player2Id],
    );
    const ballotId = firstId(ballot, "choice-shape Ballot");

    try {
      await expectConstraintViolation(
        () =>
          pool.query(
            `insert into vote (
               ballot_id, edition_id, visitor_id, choice, winner_player_id, loser_player_id, status
             ) values ($1, $2, $3, 'SKIP', $4, $5, 'VALID')`,
            [
              ballotId,
              fixture.draftEditionId,
              fixture.visitorId,
              fixture.player1Id,
              fixture.player2Id,
            ],
          ),
        "vote_choice_player_shape",
      );
    } finally {
      await pool.query(`delete from ballot where id = $1`, [ballotId]);
    }
  });

  it("enforces pending import review lifecycle", async () => {
    const syncRun = await pool.query<{ id: string }>(
      `insert into sync_run (job_name, provider, started_at, finished_at, status)
       values ('integration-import', 'fixture', now() - interval '1 minute', now(), 'SUCCEEDED')
       returning id`,
    );
    const syncRunId = firstId(syncRun, "sync run");

    try {
      await expectConstraintViolation(
        () =>
          pool.query(
            `insert into pending_import_change (
               sync_run_id, change_type, target_external_key, proposed_data, status
             ) values ($1, 'PLAYER', 'fixture-player', '{}'::jsonb, 'APPROVED')`,
            [syncRunId],
          ),
        "pending_import_review_state",
      );
    } finally {
      await pool.query(`delete from pending_import_change where sync_run_id = $1`, [syncRunId]);
      await pool.query(`delete from sync_run where id = $1`, [syncRunId]);
    }
  });

  it("applies the development seed repeatedly without duplicate domain rows", async () => {
    const database = drizzle(pool, { schema });
    await seedDevelopmentData(database);
    await seedDevelopmentData(database);

    const counts = await pool.query<{
      players: string;
      pool_players: string;
      rankings: string;
      rosters: string;
      teams: string;
    }>(
      `select
         (select count(*) from team where slug like 'sample-%') as teams,
         (select count(*) from player where slug like 'sample-%') as players,
         (select count(*) from roster_membership where source = 'development-seed') as rosters,
         (select count(*) from pool_player_entry ppe
            join player p on p.id = ppe.player_id where p.slug like 'sample-%') as pool_players,
         (select count(*) from player_ranking pr
            join player p on p.id = pr.player_id where p.slug like 'sample-%') as rankings`,
    );

    expect(counts.rows[0]).toEqual({
      players: "4",
      pool_players: "4",
      rankings: "4",
      rosters: "4",
      teams: "2",
    });
  });
});
