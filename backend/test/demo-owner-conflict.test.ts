/* oxlint-disable import/max-dependencies -- the email and Адрес are taken before the seed, so the test migrates and inserts on its own */
import { fileURLToPath } from "node:url";

import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/identity/passwords.js";
import { testAdmin as admin, testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the demo Календарь opens with a horizon of 14 days
const demoHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Календарь starts with a limit of 2
const openingDailyLimit = 2;

const demoSlug = "demo";
const demoEmail = "demo@example.com";
const demoPassword = "demo-owner-1";
/** 08:00 on 2026-11-02 in Europe/Moscow, before the first Слот of the day. */
const beforeGrid = new Date("2026-11-02T05:00:00.000Z");

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const firstHeader = (header: string | string[] | undefined): string | undefined => {
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
};

/** `sid=…` from a `Set-Cookie` header, without the cookie attributes. */
const sessionPair = (header: string | string[] | undefined): string => {
  const raw = firstHeader(header);
  if (raw === undefined) {
    throw new Error("Set-Cookie is missing");
  }
  const [pair] = raw.split(";");
  if (pair === undefined || !pair.startsWith("sid=")) {
    throw new Error("Set-Cookie is missing sid");
  }
  return pair;
};

interface Occupant {
  email: string;
  name: string;
  password: string;
  slug: string;
}

const logIn = async (
  application: INestApplication,
  email: string,
  password: string,
): Promise<request.Response> => {
  const loggedIn = await request(httpServer(application))
    .post("/api/auth/login")
    .send({ email, password });
  expectMatchesSpec(loggedIn, "post", "/api/auth/login");
  return loggedIn;
};

const listOwners = async (application: INestApplication): Promise<request.Response> => {
  const loggedIn = await logIn(application, admin.email, admin.password);
  expect(loggedIn.status).toBe(200);
  const response = await request(httpServer(application))
    .get("/api/admin/owners")
    .set("Cookie", sessionPair(loggedIn.headers["set-cookie"]));
  expectMatchesSpec(response, "get", "/api/admin/owners");
  return response;
};

const readCalendar = async (
  application: INestApplication,
  slug: string,
): Promise<request.Response> => {
  const response = await request(httpServer(application)).get(`/api/calendars/${slug}`);
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}");
  return response;
};

const ownerIdOf = (rows: { id: string }[]): string => {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("occupant was not stored");
  }
  return row.id;
};

const insertOccupant = async (pool: Pool, occupant: Occupant): Promise<void> => {
  const passwordHash = await hashPassword(occupant.password);
  const inserted = await pool.query<{ id: string }>(
    `insert into users (id, email, name, password_hash, role)
     values (gen_random_uuid(), $1, $2, $3, 'owner')
     returning id`,
    [occupant.email, occupant.name, passwordHash],
  );
  await pool.query(
    `insert into calendars (id, owner_id, slug, time_zone, planning_horizon_days, daily_booking_limit)
     values (gen_random_uuid(), $1, $2, 'Europe/Moscow', $3, $4)`,
    [ownerIdOf(inserted.rows), occupant.slug, demoHorizonDays, openingDailyLimit],
  );
};

/** Migrations only. The demo seed has not run, so the occupant is whoever already registered. */
const seedOccupant = async (connectionUri: string, occupant: Occupant): Promise<void> => {
  const pool = new Pool({ connectionString: connectionUri });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    await insertOccupant(pool, occupant);
  } finally {
    await pool.end();
  }
};

interface OccupiedApp {
  application: INestApplication;
  postgres: StartedPostgreSqlContainer;
}

const bootOccupied = async (occupant: Occupant): Promise<OccupiedApp> => {
  const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();
  await seedOccupant(postgres.getConnectionUri(), occupant);
  const application = await createApp(
    testAppOptions(postgres.getConnectionUri(), { now: () => beforeGrid }),
  );
  await application.init();
  return { application, postgres };
};

const stopOccupied = async (occupied: OccupiedApp | undefined): Promise<void> => {
  if (occupied === undefined) {
    return;
  }
  await occupied.application.close();
  await occupied.postgres.stop();
};

const occupiedApp = (occupied: OccupiedApp | undefined): INestApplication => {
  if (occupied === undefined) {
    throw new Error("The app was not started");
  }
  return occupied.application;
};

const expectOccupantUnchanged = async (
  application: INestApplication,
  occupant: Occupant,
): Promise<void> => {
  const seeded = await logIn(application, demoEmail, demoPassword);
  expect(seeded.status).toBe(401);
  const loggedIn = await logIn(application, occupant.email, occupant.password);
  expect(loggedIn.status).toBe(200);
  expect(loggedIn.body).toEqual({
    calendarSlug: occupant.slug,
    email: occupant.email,
    name: occupant.name,
    role: "owner",
    timeZone: "Europe/Moscow",
  });
  const owners = await listOwners(application);
  expect(owners.body).toMatchObject({
    owners: [{ calendarSlug: occupant.slug, email: occupant.email, name: occupant.name }],
  });
};

const takenEmail: Occupant = {
  email: demoEmail,
  name: "Анна",
  password: "already-set",
  slug: "anna-taken",
};

const takenSlug: Occupant = {
  email: "other@example.com",
  name: "Борис",
  password: "already-set",
  slug: demoSlug,
};

describe("an email that already belongs to a Владелец", () => {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
  let occupied: OccupiedApp | undefined = undefined;

  beforeAll(async () => {
    occupied = await bootOccupied(takenEmail);
  });

  afterAll(async () => {
    await stopOccupied(occupied);
  });

  it("starts and leaves that Владелец in place", async () => {
    const application = occupiedApp(occupied);
    await expectOccupantUnchanged(application, takenEmail);
    const calendar = await readCalendar(application, demoSlug);
    expect(calendar.status).toBe(404);
    expect(calendar.body).toMatchObject({ code: "calendar_not_found" });
  });
});

describe("an Адрес календаря that is already taken", () => {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
  let occupied: OccupiedApp | undefined = undefined;

  beforeAll(async () => {
    occupied = await bootOccupied(takenSlug);
  });

  afterAll(async () => {
    await stopOccupied(occupied);
  });

  it("starts and does not add «Звонок» to that Календарь", async () => {
    const application = occupiedApp(occupied);
    await expectOccupantUnchanged(application, takenSlug);
    const calendar = await readCalendar(application, demoSlug);
    expect(calendar.status).toBe(200);
    expect(calendar.body).toMatchObject({ eventTypes: [], ownerName: "Борис" });
  });
});

const startPair = async (): Promise<{
  first: INestApplication;
  postgres: StartedPostgreSqlContainer;
  second: INestApplication;
}> => {
  const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();
  const pool = new Pool({ connectionString: postgres.getConnectionUri() });
  // Migrating together races on `CREATE SCHEMA drizzle`. The seed is what this test races.
  await migrate(drizzle(pool), { migrationsFolder });
  await pool.end();
  const options = testAppOptions(postgres.getConnectionUri(), { now: () => beforeGrid });
  const first = await createApp(options);
  const second = await createApp(options);
  await Promise.all([first.init(), second.init()]);
  return { first, postgres, second };
};

const expectOneDemo = async (application: INestApplication): Promise<void> => {
  const loggedIn = await logIn(application, demoEmail, demoPassword);
  expect(loggedIn.status).toBe(200);
  const owners = await listOwners(application);
  expect(owners.body).toMatchObject({
    owners: [{ calendarSlug: demoSlug, email: demoEmail, name: "Демо" }],
  });
};

interface RacedApps {
  first: INestApplication;
  postgres: StartedPostgreSqlContainer;
  second: INestApplication;
}

const stopRaced = async (raced: RacedApps | undefined): Promise<void> => {
  if (raced === undefined) {
    return;
  }
  await raced.first.close();
  await raced.second.close();
  await raced.postgres.stop();
};

describe("two startups at once", () => {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
  let raced: RacedApps | undefined = undefined;

  beforeAll(async () => {
    raced = await startPair();
  });

  afterAll(async () => {
    await stopRaced(raced);
  });

  it("keeps a single demo Владелец", async () => {
    if (raced === undefined) {
      throw new Error("The apps were not started");
    }
    await expectOneDemo(raced.first);
  });
});
