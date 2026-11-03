import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/identity/passwords.js";
import { testAdmin as admin, testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the demo Календарь opens with a horizon of 14 days
const demoHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the demo Тип события lasts 30 minutes
const demoDurationMinutes = 30;

const demoSlug = "demo";
const demoEmail = "demo@example.com";
const demoPassword = "demo-owner-1";
const changedPassword = "changed-secret";
/** 08:00 on 2026-11-02 in Europe/Moscow, before the first Слот of the day. */
const beforeGrid = new Date("2026-11-02T05:00:00.000Z");
/** 09:00 that day. */
const firstSlot = "2026-11-02T06:00:00.000Z";
const guest = { email: "boris@example.com", name: "Борис" };

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;
// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let app: INestApplication | undefined = undefined;

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const runningApp = (): INestApplication => {
  if (app === undefined) {
    throw new Error("The app was not started");
  }
  return app;
};

const startedDatabase = (): StartedPostgreSqlContainer => {
  if (database === undefined) {
    throw new Error("Postgres was not started");
  }
  return database;
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(
    testAppOptions(startedDatabase().getConnectionUri(), { now: () => beforeGrid }),
  );
  await app.init();
});

afterAll(async () => {
  if (app !== undefined) {
    await app.close();
  }
  if (database !== undefined) {
    await database.stop();
  }
});

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

interface EventTypeRow {
  id: string;
}

const isEventTypeRow = (value: unknown): value is EventTypeRow =>
  isRecord(value) && typeof value["id"] === "string";

const eventTypeIdOf = (body: unknown): string => {
  if (
    !isRecord(body) ||
    !Array.isArray(body["eventTypes"]) ||
    !body["eventTypes"].every(isEventTypeRow)
  ) {
    throw new Error("public calendar has no Типы событий");
  }
  const [first] = body["eventTypes"];
  if (first === undefined) {
    throw new Error("public calendar has no Типы событий");
  }
  return first.id;
};

const bookDemoSlot = async (eventTypeId: string): Promise<void> => {
  const booked = await request(httpServer(runningApp()))
    .post(`/api/calendars/${demoSlug}/bookings`)
    .send({ eventTypeId, guest, startAt: firstSlot });
  expectMatchesSpec(booked, "post", "/api/calendars/{calendarSlug}/bookings");
  expect(booked.status).toBe(201);
  expect(booked.body).toMatchObject({
    ownerName: "Демо",
    ownerTimeZone: "Europe/Moscow",
    startAt: firstSlot,
  });
};

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

const expectUpcoming = async (cookie: string): Promise<void> => {
  const upcoming = await request(httpServer(runningApp()))
    .get("/api/owner/bookings")
    .set("Cookie", cookie);
  expectMatchesSpec(upcoming, "get", "/api/owner/bookings");
  expect(upcoming.status).toBe(200);
  expect(upcoming.body).toMatchObject({
    bookings: [{ eventTypeName: "Звонок", guest, startAt: firstSlot }],
  });
};

/** There is no API to change a password. The restart must not write the seed password back. */
const replaceDemoPassword = async (password: string): Promise<void> => {
  const pool = new Pool({ connectionString: startedDatabase().getConnectionUri() });
  try {
    const updated = await pool.query(
      "update users set password_hash = $1 where lower(email) = $2",
      [await hashPassword(password), demoEmail],
    );
    expect(updated.rowCount).toBe(1);
  } finally {
    await pool.end();
  }
};

const readCalendar = async (
  application: INestApplication,
  slug: string,
): Promise<request.Response> => {
  const response = await request(httpServer(application)).get(`/api/calendars/${slug}`);
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}");
  return response;
};

const readDemoCalendar = async (): Promise<request.Response> => {
  const response = await readCalendar(runningApp(), demoSlug);
  return response;
};

const restart = async (): Promise<INestApplication> => {
  const restarted = await createApp(
    testAppOptions(startedDatabase().getConnectionUri(), { now: () => beforeGrid }),
  );
  await restarted.init();
  return restarted;
};

const expectSameAccount = async (application: INestApplication): Promise<void> => {
  const loggedIn = await logIn(application, demoEmail, demoPassword);
  expect(loggedIn.status).toBe(200);
  const owners = await listOwners(application);
  expect(owners.status).toBe(200);
  expect(owners.body).toMatchObject({
    owners: [{ calendarSlug: demoSlug, email: demoEmail, name: "Демо", timeZone: "Europe/Moscow" }],
  });
};

const expectChangedPassword = async (application: INestApplication): Promise<void> => {
  const seeded = await logIn(application, demoEmail, demoPassword);
  expect(seeded.status).toBe(401);
  const loggedIn = await logIn(application, demoEmail, changedPassword);
  expect(loggedIn.status).toBe(200);
  expect(loggedIn.body).toMatchObject({ name: "Демо", role: "owner" });
};

describe("демо-Владелец at startup", () => {
  it("publishes /u/demo with one Тип события «Звонок»", async () => {
    const response = await readDemoCalendar();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      eventTypes: [
        {
          description: "Короткий созвон на 30 минут",
          durationMinutes: demoDurationMinutes,
          name: "Звонок",
        },
      ],
      ownerName: "Демо",
      planningHorizonDays: demoHorizonDays,
      timeZone: "Europe/Moscow",
    });
  });

  it("lets a Гость book a Слот that the demo Владелец then sees", async () => {
    const calendar = await readDemoCalendar();
    const calendarBody: unknown = calendar.body;
    await bookDemoSlot(eventTypeIdOf(calendarBody));

    const loggedIn = await logIn(runningApp(), demoEmail, demoPassword);
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body).toEqual({
      calendarSlug: demoSlug,
      email: demoEmail,
      name: "Демо",
      role: "owner",
      timeZone: "Europe/Moscow",
    });
    await expectUpcoming(sessionPair(loggedIn.headers["set-cookie"]));
  });
});

describe("a restart", () => {
  it("keeps one Владелец and the same password across a restart", async () => {
    const restarted = await restart();
    try {
      await expectSameAccount(restarted);
    } finally {
      await restarted.close();
    }

    const calendar = await readDemoCalendar();
    expect(calendar.body).toMatchObject({ eventTypes: [{ name: "Звонок" }] });
  });

  it("does not put the seed password back on restart", async () => {
    await replaceDemoPassword(changedPassword);
    const restarted = await restart();
    try {
      await expectChangedPassword(restarted);
    } finally {
      await restarted.close();
    }
  });
});
