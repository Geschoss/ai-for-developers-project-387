import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
const guestName = "Борис";
const raceEmails = ["a@example.com", "b@example.com", "c@example.com", "d@example.com"];
// oxlint-disable-next-line eslint/no-magic-numbers -- 48 hours later is another civil day in Europe/Moscow
const laterDayMs = 48 * 60 * 60 * 1000;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid these tests book is 30 minutes
const halfHourMinutes = 30;

interface Slot {
  startAt: string;
  status: string;
}

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

let sequence = 0;

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

interface Owner {
  eventTypeId: string;
  slug: string;
}

const registerOwner = async (): Promise<Owner> => {
  sequence += 1;
  const slug = `book-${sequence}`;
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone: "Europe/Moscow",
    });
  expectMatchesSpec(response, "post", "/api/auth/register");
  expect(response.status).toBe(201);
  const eventTypeId = await openEventType(
    runningApp(),
    sessionPair(response.headers["set-cookie"]),
    {
      durationMinutes: halfHourMinutes,
    },
  );
  return { eventTypeId, slug };
};

const listSlots = async (owner: Owner): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .get(`/api/calendars/${owner.slug}/slots`)
    .query({ ...wideRange, eventTypeId: owner.eventTypeId });
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

const furthestSlot = (slots: Slot[]): Slot => {
  const [slot] = slots.slice(-1);
  if (slot === undefined) {
    throw new Error("Expected a bookable Слот");
  }
  return slot;
};

const bookedSlots = (slots: Slot[]): Slot[] => slots.filter((slot) => slot.status === "booked");

const book = async (owner: Owner, startAt: string, email: string): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .post(`/api/calendars/${owner.slug}/bookings`)
    .send({ eventTypeId: owner.eventTypeId, guest: { email, name: guestName }, startAt });
  expectMatchesSpec(response, "post", "/api/calendars/{calendarSlug}/bookings");
  return response;
};

const problemCode = (response: request.Response): string | undefined => {
  const body: unknown = response.body;
  if (!isRecord(body) || typeof body["code"] !== "string") {
    return undefined;
  }
  return body["code"];
};

const withStatus = (responses: request.Response[], status: number): request.Response[] =>
  responses.filter((response) => response.status === status);

const hiddenGuest = (response: request.Response, startAt: string): void => {
  const body = JSON.stringify(response.body);
  expect(bookedSlots(slotsOf(response))).toEqual([{ startAt, status: "booked" }]);
  expect(body).not.toContain(guestName);
  expect(body).not.toContain("boris@example.com");
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(testAppOptions(database.getConnectionUri()));
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

const laterSlot = (slots: Slot[], first: Slot): Slot => {
  const later = slots.find(
    (slot) => Date.parse(slot.startAt) >= Date.parse(first.startAt) + laterDayMs,
  );
  if (later === undefined) {
    throw new Error("Expected a Слот on a later day");
  }
  return later;
};

const bookTwoDays = async (owner: Owner): Promise<{ first: string; later: string }> => {
  const slots = slotsOf(await listSlots(owner));
  const [first] = slots;
  if (first === undefined) {
    throw new Error("Expected a bookable Слот");
  }
  const later = laterSlot(slots, first);
  const earlierBooking = await book(owner, first.startAt, "earlier@example.com");
  const laterBooking = await book(owner, later.startAt, "later@example.com");
  expect(earlierBooking.status).toBe(201);
  expect(laterBooking.status).toBe(201);
  return { first: first.startAt, later: later.startAt };
};

describe("POST /api/calendars/:slug/bookings", () => {
  it("books a free Слот and then shows it as booked, without the Гость", async () => {
    const owner = await registerOwner();
    const slot = furthestSlot(slotsOf(await listSlots(owner)));
    const response = await book(owner, slot.startAt, "boris@example.com");

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      note: null,
      ownerName: "Анна",
      ownerTimeZone: "Europe/Moscow",
      startAt: slot.startAt,
    });
    hiddenGuest(await listSlots(owner), slot.startAt);
  });

  it.each([
    "2026-11-02T05:00:00.000Z",
    "2026-11-02T06:15:00.000Z",
    "2026-11-02T06:00:01.000Z",
    "2026-11-02T15:00:00.000Z",
  ])("rejects %s: it is not a start on the owner's grid", async (startAt) => {
    const owner = await registerOwner();
    const response = await book(owner, startAt, "off-grid@example.com");

    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe("not_a_slot_start");
  });

  it("gives one Слот to exactly one of several simultaneous Гости", async () => {
    const owner = await registerOwner();
    const slot = furthestSlot(slotsOf(await listSlots(owner)));
    const responses = await Promise.all(
      raceEmails.map(async (email) => {
        const response = await book(owner, slot.startAt, email);
        return response;
      }),
    );
    const created = withStatus(responses, 201);
    const taken = withStatus(responses, 409);

    expect(created).toHaveLength(1);
    expect(taken).toHaveLength(raceEmails.length - 1);
    expect(taken.every((response) => problemCode(response) === "slot_taken")).toBe(true);
    hiddenGuest(await listSlots(owner), slot.startAt);
  });
});

describe("a Календарь keeps Бронирования of other days", () => {
  it("keeps a Бронирование on another day when a later day is booked", async () => {
    const owner = await registerOwner();
    const booked = await bookTwoDays(owner);
    const stored = bookedSlots(slotsOf(await listSlots(owner)));

    expect(stored).toContainEqual({ startAt: booked.first, status: "booked" });
    expect(stored).toContainEqual({ startAt: booked.later, status: "booked" });
  });
});
