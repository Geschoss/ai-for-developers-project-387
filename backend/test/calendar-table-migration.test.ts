import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const drizzleDir = fileURLToPath(new URL("../drizzle", import.meta.url));

const ownerId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";
const bookingId = "33333333-3333-4333-8333-333333333333";
const slug = "anna";
const timeZone = "Europe/Moscow";
const guestEmail = "boris@example.com";
const slotStart = "2026-11-02T14:30:00.000Z";
// oxlint-disable-next-line eslint/no-magic-numbers -- stored horizon, distinct from the opening default of 14
const storedHorizonDays = 21;
// oxlint-disable-next-line eslint/no-magic-numbers -- stored limit, distinct from the opening default of 2
const storedDailyLimit = 5;

interface JournalEntry {
  breakpoints: boolean;
  idx: number;
  tag: string;
  version: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

const isJournal = (value: unknown): value is Journal => {
  if (typeof value !== "object" || value === null || !("entries" in value)) {
    return false;
  }
  return Array.isArray(value.entries);
};

const readJournal = (): Journal => {
  const parsed: unknown = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"));
  if (!isJournal(parsed)) {
    throw new Error("Migration journal is missing entries");
  }
  return parsed;
};

/** Migrations up to and including bookings, before the Календарь table exists. */
const baselineFolder = (): string => {
  const folder = mkdtempSync(join(tmpdir(), "calendar-baseline-"));
  mkdirSync(join(folder, "meta"));
  const journal = readJournal();
  journal.entries = journal.entries.filter((entry) => /^000[0-3]_/u.test(entry.tag));
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) {
    cpSync(join(drizzleDir, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
  }
  return folder;
};

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;

const connectionUri = (): string => {
  if (database === undefined) {
    throw new Error("Postgres was not started");
  }
  return database.getConnectionUri();
};

const seedPreviousSchema = async (pool: Pool): Promise<void> => {
  await pool.query(
    `insert into users (
      id, role, name, email, password_hash, calendar_slug, time_zone,
      planning_horizon_days, daily_booking_limit
    ) values
      ($1, 'owner', 'Анна', 'anna@example.com', 'hash', $2, $3, $4, $5),
      ($6, 'admin', null, 'admin@example.com', 'hash', null, null, null, null)`,
    [ownerId, slug, timeZone, storedHorizonDays, storedDailyLimit, adminId],
  );
  await pool.query(
    `insert into bookings (id, owner_id, guest_name, guest_email, start_at)
     values ($1, $2, 'Борис', $3, $4)`,
    [bookingId, ownerId, guestEmail, slotStart],
  );
};

interface CalendarRow {
  daily_booking_limit: number;
  planning_horizon_days: number;
  slug: string;
  time_zone: string;
}

interface BookingRow {
  guest_email: string;
  owner_id: string;
  start_at: Date;
}

interface CountRow {
  found: number;
}

interface NameRow {
  column_name: string;
}

const row = <Row>(rows: readonly Row[], label: string): Row => {
  const [first] = rows;
  if (first === undefined) {
    throw new Error(`${label} is missing`);
  }
  return first;
};

const applyMigration = async (pool: Pool): Promise<void> => {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: baselineFolder() });
  await seedPreviousSchema(pool);
  await migrate(db, { migrationsFolder: drizzleDir });
};

const expectOwnerCalendar = async (pool: Pool): Promise<void> => {
  const calendars = await pool.query<CalendarRow>(
    `select slug, time_zone, planning_horizon_days, daily_booking_limit
     from calendars
     where owner_id = $1`,
    [ownerId],
  );
  expect(calendars.rows).toEqual([
    {
      daily_booking_limit: storedDailyLimit,
      planning_horizon_days: storedHorizonDays,
      slug,
      time_zone: timeZone,
    },
  ]);
};

const expectAdminWithoutCalendar = async (pool: Pool): Promise<void> => {
  const adminCalendars = await pool.query<CountRow>(
    "select count(*)::int as found from calendars where owner_id = $1",
    [adminId],
  );
  expect(row(adminCalendars.rows, "Администратор")).toEqual({ found: 0 });
};

const expectBookingKept = async (pool: Pool): Promise<void> => {
  const booking = await pool.query<BookingRow>(
    `select calendars.owner_id, bookings.guest_email, bookings.start_at
     from bookings
     join calendars on calendars.id = bookings.calendar_id
     where bookings.id = $1`,
    [bookingId],
  );
  const stored = row(booking.rows, "Бронирование");
  expect(stored.owner_id).toBe(ownerId);
  expect(stored.guest_email).toBe(guestEmail);
  expect(stored.start_at.toISOString()).toBe(slotStart);
};

const expectUsersWithoutCalendarColumns = async (pool: Pool): Promise<void> => {
  const droppedColumns = await pool.query<NameRow>(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'users'
       and column_name = any($1)`,
    [["calendar_slug", "time_zone", "planning_horizon_days", "daily_booking_limit"]],
  );
  const roleShape = await pool.query<CountRow>(
    "select count(*)::int as found from pg_constraint where conname = 'users_role_shape'",
  );
  expect(droppedColumns.rows).toEqual([]);
  expect(row(roleShape.rows, "users_role_shape")).toEqual({ found: 0 });
};

const expectMigrated = async (pool: Pool): Promise<void> => {
  await expectOwnerCalendar(pool);
  await expectAdminWithoutCalendar(pool);
  await expectBookingKept(pool);
  await expectUsersWithoutCalendarColumns(pool);
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
});

afterAll(async () => {
  if (database !== undefined) {
    await database.stop();
  }
});

describe("Календарь table migration", () => {
  it("gives each Владелец one Календарь, keeps Бронирования, and leaves the Администратор without one", async () => {
    const pool = new Pool({ connectionString: connectionUri() });
    try {
      await applyMigration(pool);
      await expectMigrated(pool);
    } finally {
      await pool.end();
    }
  });
});
