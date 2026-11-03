import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
/** Before the fix, one of six instances read another's Администратор as a Владелец in most rounds. */
const instances = 6;
const rounds = 3;
/** Each round starts its own Postgres container, so the test outlasts the default 5 s. */
const raceTimeoutMs = 120_000;

/** Starts {@link instances} apps at once on a fresh database and returns how many startups failed. */
const startTogether = async (databaseUrl: string): Promise<number> => {
  const options = testAppOptions(databaseUrl);
  const apps = await Promise.all(
    Array.from({ length: instances }, async () => {
      const application = await createApp(options);
      return application;
    }),
  );
  const started = await Promise.allSettled(
    apps.map(async (application) => {
      await application.init();
    }),
  );
  await Promise.all(
    apps.map(async (application) => {
      await application.close();
    }),
  );
  return started.filter((result) => result.status === "rejected").length;
};

const countAdmins = async (pool: Pool): Promise<number> => {
  const result = await pool.query<{ admins: number }>(
    "SELECT count(*)::int AS admins FROM users WHERE role = 'admin'",
  );
  const [row] = result.rows;
  if (row === undefined) {
    throw new Error("count(*) returned no row");
  }
  return row.admins;
};

/** One round on its own container: failed startups and the number of Администраторы afterwards. */
const raceOnce = async (): Promise<{ admins: number; failed: number }> => {
  const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();
  const pool = new Pool({ connectionString: postgres.getConnectionUri() });
  try {
    // Migrating together races on `CREATE SCHEMA drizzle`. The seed is what this test races.
    await migrate(drizzle(pool), { migrationsFolder });
    const failed = await startTogether(postgres.getConnectionUri());
    return { admins: await countAdmins(pool), failed };
  } finally {
    await pool.end();
    await postgres.stop();
  }
};

describe("Администратор seed under concurrent startups", () => {
  it(
    "starts every instance and keeps one Администратор",
    async () => {
      for (let round = 0; round < rounds; round += 1) {
        // oxlint-disable-next-line no-await-in-loop -- each round needs a fresh database, one after another
        await expect(raceOnce()).resolves.toStrictEqual({ admins: 1, failed: 0 });
      }
    },
    raceTimeoutMs,
  );
});
