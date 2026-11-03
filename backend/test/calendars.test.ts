import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a horizon of 14 days
const defaultPlanningHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid starts at 09:00
const firstSlotHour = 9;
// oxlint-disable-next-line eslint/no-magic-numbers -- the last Слот starts at 17:30
const lastSlotHour = 17;
// oxlint-disable-next-line eslint/no-magic-numbers -- a Слот is 30 minutes
const slotLengthMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- minutes in an hour
const minutesPerHour = 60;

const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
const guestName = "Секретное имя";
const guestEmail = "secret-guest@example.com";

interface Slot {
  startAt: string;
  status: string;
}

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;
// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let app: INestApplication | undefined = undefined;
let databaseUrl = "";

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const runningApp = (): INestApplication => {
  if (app === undefined) {
    throw new Error("The app was not started");
  }
  return app;
};

let sequence = 0;

const firstHeader = (header: string | string[] | undefined): string | undefined => {
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
};

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

interface Owner {
  cookie: string;
  slug: string;
}

const registerOwner = async (timeZone = "Europe/Moscow"): Promise<Owner> => {
  sequence += 1;
  const slug = `guest-${sequence}`;
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone,
    });
  expect(response.status).toBe(201);
  return { cookie: sessionPair(response.headers["set-cookie"]), slug };
};

const readCalendar = async (slug: string): Promise<request.Response> => {
  const response = await request(httpServer(runningApp())).get(`/api/calendars/${slug}`);
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}");
  return response;
};

const listSlots = async (
  slug: string,
  eventTypeId: string,
  query: { from: string; to: string } = wideRange,
): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .get(`/api/calendars/${slug}/slots`)
    .query({ ...query, eventTypeId });
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}/slots");
  return response;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSlot = (value: unknown): value is Slot => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value["startAt"] === "string" && typeof value["status"] === "string";
};

const slotsOf = (response: request.Response): Slot[] => {
  const body: unknown = response.body;
  if (!isRecord(body) || !Array.isArray(body["slots"]) || !body["slots"].every(isSlot)) {
    throw new Error("slots response is not a SlotList");
  }
  return body["slots"];
};

const minuteOfDay = (startAt: string, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).formatToParts(new Date(startAt));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (found === undefined) {
      throw new Error(`Missing ${type}`);
    }
    return Number(found.value);
  };
  return read("hour") * minutesPerHour + read("minute");
};

const onOwnerGrid = (startAt: string): boolean => {
  const minute = minuteOfDay(startAt, "Europe/Moscow");
  const lastStart = lastSlotHour * minutesPerHour + slotLengthMinutes;
  return (
    minute >= firstSlotHour * minutesPerHour &&
    minute <= lastStart &&
    minute % slotLengthMinutes === 0
  );
};

const expectBookable = (slots: Slot[], before: number): void => {
  const starts = slots.map((slot) => slot.startAt);
  expect(slots.length).toBeGreaterThan(0);
  expect(slots.every((slot) => slot.status === "free")).toBe(true);
  expect(slots.every((slot) => onOwnerGrid(slot.startAt))).toBe(true);
  expect(slots.every((slot) => new Date(slot.startAt).getTime() > before)).toBe(true);
  expect(starts.toSorted()).toEqual(starts);
  expect(JSON.stringify(slots)).not.toContain("@");
};

const bookedSlots = (slots: Slot[]): Slot[] => slots.filter((slot) => slot.status === "booked");

const furthestSlot = (slots: Slot[]): Slot => {
  const [slot] = slots.slice(-1);
  if (slot === undefined) {
    throw new Error("Expected a bookable Слот");
  }
  return slot;
};

const expectHiddenGuest = (response: request.Response, startAt: string): void => {
  const body = JSON.stringify(response.body);
  expect(bookedSlots(slotsOf(response))).toEqual([{ startAt, status: "booked" }]);
  expect(body).not.toContain(guestName);
  expect(body).not.toContain(guestEmail);
};

const insertBooking = async (slug: string, startAt: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const inserted = await client.query(
      `insert into bookings (id, calendar_id, event_type_id, guest_name, guest_email, start_at, end_at)
       select $1, calendars.id, event_types.id, $2, $3, $4, $4::timestamptz + interval '30 minutes'
       from calendars
       join event_types on event_types.calendar_id = calendars.id
       where calendars.slug = $5`,
      [randomUUID(), guestName, guestEmail, startAt, slug],
    );
    expect(inserted.rowCount).toBe(1);
  } finally {
    await client.end();
  }
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  databaseUrl = database.getConnectionUri();
  app = await createApp(testAppOptions(databaseUrl));
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

describe("GET /api/calendars/:slug", () => {
  it("returns the public calendar and no account data", async () => {
    const owner = await registerOwner();
    const response = await readCalendar(owner.slug);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      eventTypes: [],
      ownerName: "Анна",
      planningHorizonDays: defaultPlanningHorizonDays,
      timeZone: "Europe/Moscow",
    });
    expect(JSON.stringify(response.body)).not.toContain("@");
  });

  it("answers calendar_not_found for an unknown Адрес календаря", async () => {
    const response = await readCalendar("missing-owner");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: "calendar_not_found" });
  });
});

const unknownType = "11111111-1111-4111-8111-111111111111";

const halfHourType = async (owner: Owner): Promise<string> => {
  const eventTypeId = await openEventType(runningApp(), owner.cookie, {
    durationMinutes: slotLengthMinutes,
  });
  return eventTypeId;
};

describe("GET /api/calendars/:slug/slots", () => {
  it("lists future Слоты on the owner's grid and nothing about a Гость", async () => {
    const owner = await registerOwner();
    const eventTypeId = await halfHourType(owner);
    const before = Date.now();
    const response = await listSlots(owner.slug, eventTypeId);

    expect(response.status).toBe(200);
    expectBookable(slotsOf(response), before);
  });

  it("marks a stored Бронирование as booked without the Гость's name or email", async () => {
    const owner = await registerOwner();
    const eventTypeId = await halfHourType(owner);
    const furthest = furthestSlot(slotsOf(await listSlots(owner.slug, eventTypeId)));
    await insertBooking(owner.slug, furthest.startAt);
    const response = await listSlots(owner.slug, eventTypeId);

    expectHiddenGuest(response, furthest.startAt);
  });

  it("returns no Слоты when the window is empty", async () => {
    const owner = await registerOwner();
    const response = await listSlots(owner.slug, await halfHourType(owner), {
      from: "2026-12-02T00:00:00.000Z",
      to: "2026-12-01T00:00:00.000Z",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ slots: [] });
  });

  it("answers calendar_not_found for an unknown Адрес календаря", async () => {
    const response = await listSlots("missing-owner", unknownType);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: "calendar_not_found" });
  });
});
