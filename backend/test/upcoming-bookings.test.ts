import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAdmin as admin, testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

const ownerTimeZone = "Europe/Moscow";
/** 08:00 on 2026-11-02 in Europe/Moscow, before the first Слот of the day. */
const beforeGrid = new Date("2026-11-02T05:00:00.000Z");
/** 09:00 that day. */
const firstSlot = "2026-11-02T06:00:00.000Z";
/** 09:30 that day. */
const secondSlot = "2026-11-02T06:30:00.000Z";
// oxlint-disable-next-line eslint/no-magic-numbers -- a Бронирование created during the test is only seconds old
const createdRecentlyMs = 120_000;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid these tests book is 30 minutes
const halfHourMinutes = 30;

interface Guest {
  email: string;
  name: string;
}

interface ListedBooking {
  createdAt: string;
  eventTypeName: string;
  guest: Guest;
  id: string;
  startAt: string;
}

interface Owner {
  cookie: string;
  eventTypeId: string;
  slug: string;
}

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;
// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let app: INestApplication | undefined = undefined;
let now = beforeGrid;

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const runningApp = (): INestApplication => {
  if (app === undefined) {
    throw new Error("The app was not started");
  }
  return app;
};

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

const isGuest = (value: unknown): value is Guest =>
  isRecord(value) && typeof value["email"] === "string" && typeof value["name"] === "string";

const isBooking = (value: unknown): value is ListedBooking => {
  if (!isRecord(value) || !isGuest(value["guest"])) {
    return false;
  }
  return (
    typeof value["createdAt"] === "string" &&
    typeof value["eventTypeName"] === "string" &&
    typeof value["id"] === "string" &&
    typeof value["startAt"] === "string"
  );
};

const bookingsOf = (response: request.Response): ListedBooking[] => {
  const body: unknown = response.body;
  if (!isRecord(body) || !Array.isArray(body["bookings"]) || !body["bookings"].every(isBooking)) {
    throw new Error("bookings response is not a BookingList");
  }
  return body["bookings"];
};

let sequence = 0;

const registerOwner = async (): Promise<Owner> => {
  sequence += 1;
  const slug = `events-${sequence}`;
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone: ownerTimeZone,
    });
  expectMatchesSpec(response, "post", "/api/auth/register");
  expect(response.status).toBe(201);
  const cookie = sessionPair(response.headers["set-cookie"]);
  const eventTypeId = await openEventType(runningApp(), cookie, {
    durationMinutes: halfHourMinutes,
    name: "Звонок",
  });
  return { cookie, eventTypeId, slug };
};

const adminCookie = async (): Promise<string> => {
  const response = await request(httpServer(runningApp())).post("/api/auth/login").send(admin);
  expectMatchesSpec(response, "post", "/api/auth/login");
  expect(response.status).toBe(200);
  return sessionPair(response.headers["set-cookie"]);
};

interface GuestBooking {
  email: string;
  eventTypeId: string;
  name: string;
  slug: string;
  startAt: string;
}

const book = async (booking: GuestBooking): Promise<void> => {
  const response = await request(httpServer(runningApp()))
    .post(`/api/calendars/${booking.slug}/bookings`)
    .send({
      eventTypeId: booking.eventTypeId,
      guest: { email: booking.email, name: booking.name },
      startAt: booking.startAt,
    });
  expectMatchesSpec(response, "post", "/api/calendars/{calendarSlug}/bookings");
  expect(response.status).toBe(201);
};

const listUpcoming = async (cookie?: string): Promise<request.Response> => {
  const pending = request(httpServer(runningApp())).get("/api/owner/bookings");
  if (cookie !== undefined) {
    pending.set("Cookie", cookie);
  }
  const response = await pending;
  expectMatchesSpec(response, "get", "/api/owner/bookings");
  return response;
};

const createdJustNow = (createdAt: string): void => {
  const created = Date.parse(createdAt);
  expect(Number.isNaN(created)).toBe(false);
  expect(Math.abs(created - Date.now())).toBeLessThan(createdRecentlyMs);
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(testAppOptions(database.getConnectionUri(), { now: () => now }));
  await app.init();
});

beforeEach(() => {
  now = beforeGrid;
});

afterAll(async () => {
  if (app !== undefined) {
    await app.close();
  }
  if (database !== undefined) {
    await database.stop();
  }
});

const expectFresh = (earlier: string, later: string): void => {
  createdJustNow(earlier);
  createdJustNow(later);
};

const expectOwnBookings = (response: request.Response): void => {
  const listed = bookingsOf(response);
  const [earlier, later] = listed;
  if (earlier === undefined || later === undefined) {
    throw new Error("Expected two Бронирования");
  }
  expect(response.status).toBe(200);
  expect(listed.map((booking) => booking.startAt)).toEqual([firstSlot, secondSlot]);
  expect(listed.map((booking) => booking.guest)).toEqual([
    { email: "boris@example.com", name: "Борис" },
    { email: "vera@example.com", name: "Вера" },
  ]);
  expect(listed.map((booking) => booking.eventTypeName)).toEqual(["Звонок", "Звонок"]);
  expect(JSON.stringify(response.body)).not.toContain("gleb@example.com");
  expectFresh(earlier.createdAt, later.createdAt);
};

const fillCalendars = async (owner: Owner, other: Owner): Promise<void> => {
  await book({
    email: "vera@example.com",
    eventTypeId: owner.eventTypeId,
    name: "Вера",
    slug: owner.slug,
    startAt: secondSlot,
  });
  await book({
    email: "boris@example.com",
    eventTypeId: owner.eventTypeId,
    name: "Борис",
    slug: owner.slug,
    startAt: firstSlot,
  });
  await book({
    email: "gleb@example.com",
    eventTypeId: other.eventTypeId,
    name: "Глеб",
    slug: other.slug,
    startAt: firstSlot,
  });
};

describe("GET /api/owner/bookings", () => {
  it("answers 401 without a session", async () => {
    const response = await listUpcoming();

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "unauthenticated" });
  });

  it("answers 403 to the Администратор", async () => {
    const response = await listUpcoming(await adminCookie());

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "forbidden", status: 403, title: "Forbidden" });
  });

  it("lists only this Владелец's upcoming Бронирования, soonest first", async () => {
    const owner = await registerOwner();
    const other = await registerOwner();
    expect(bookingsOf(await listUpcoming(owner.cookie))).toEqual([]);
    await fillCalendars(owner, other);

    expectOwnBookings(await listUpcoming(owner.cookie));
  });

  it("omits a Бронирование once its start has passed", async () => {
    const owner = await registerOwner();
    await book({
      email: "boris@example.com",
      eventTypeId: owner.eventTypeId,
      name: "Борис",
      slug: owner.slug,
      startAt: firstSlot,
    });
    await book({
      email: "vera@example.com",
      eventTypeId: owner.eventTypeId,
      name: "Вера",
      slug: owner.slug,
      startAt: secondSlot,
    });
    now = new Date(firstSlot);

    const listed = bookingsOf(await listUpcoming(owner.cookie));

    expect(listed.map((booking) => booking.guest.email)).toEqual(["vera@example.com"]);
  });
});
