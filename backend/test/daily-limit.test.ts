import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
const auckland = "Pacific/Auckland";
/**
 * 2026-11-03 01:00 in Pacific/Auckland (NZDT, UTC+13). UTC is still 2 November, so a check that uses the UTC
 * date would treat the Владелец's today as already over.
 */
const aucklandMorning = new Date("2026-11-02T12:00:00.000Z");
/**
 * 09:00 on 2026-11-03 in Auckland: 20:00 UTC on 2 November.
 * A Гость in UTC is still on the previous evening.
 */
const aucklandMorningSlot = "2026-11-02T20:00:00.000Z";
/** 16:30 on that Auckland day. */
const earlierSlot = "2026-11-03T03:30:00.000Z";
/** 17:00 on that Auckland day. */
const lateAfternoon = "2026-11-03T04:00:00.000Z";
/**
 * 17:30 on 2026-11-03 in Auckland: 04:30 UTC on 3 November.
 * UTC midnight falls between this Слот and `aucklandMorningSlot`, but the Владелец's day does not.
 */
const lastSlot = "2026-11-03T04:30:00.000Z";
/**
 * 09:00 on 2026-11-04 in Auckland: 20:00 UTC on 3 November.
 * Same UTC date as `lastSlot`, the next civil day for the Владелец.
 */
const nextAucklandDay = "2026-11-03T20:00:00.000Z";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a horizon of 14
const defaultPlanningHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- this test pins the Лимит бронирований to one
const limitOfOne = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- parallel attempts above a limit of two
const parallelLimit = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid these tests book is 30 minutes
const halfHourMinutes = 30;

/** 09:00, 09:30, … on 2026-11-03 in Auckland. One civil day, five different Слоты. */
const sameDaySlots = [
  aucklandMorningSlot,
  "2026-11-02T20:30:00.000Z",
  "2026-11-02T21:00:00.000Z",
  "2026-11-02T21:30:00.000Z",
  "2026-11-02T22:00:00.000Z",
];

interface Slot {
  startAt: string;
  status: string;
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
let now = aucklandMorning;

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

const problemCode = (response: request.Response): string | undefined => {
  const body: unknown = response.body;
  if (!isRecord(body) || typeof body["code"] !== "string") {
    return undefined;
  }
  return body["code"];
};

let sequence = 0;

const registerOwner = async (timeZone: string): Promise<Owner> => {
  sequence += 1;
  const slug = `limit-${sequence}`;
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone,
    });
  expectMatchesSpec(response, "post", "/api/auth/register");
  expect(response.status).toBe(201);
  const cookie = sessionPair(response.headers["set-cookie"]);
  const eventTypeId = await openEventType(runningApp(), cookie, {
    durationMinutes: halfHourMinutes,
  });
  return { cookie, eventTypeId, slug };
};

const writeLimit = async (owner: Owner, dailyBookingLimit: number): Promise<void> => {
  const response = await request(httpServer(runningApp()))
    .put("/api/owner/settings")
    .set("Cookie", owner.cookie)
    .send({
      dailyBookingLimit,
      planningHorizonDays: defaultPlanningHorizonDays,
      timeZone: auckland,
    });
  expectMatchesSpec(response, "put", "/api/owner/settings");
  expect(response.status).toBe(200);
};

const book = async (owner: Owner, startAt: string, email: string): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .post(`/api/calendars/${owner.slug}/bookings`)
    .send({ eventTypeId: owner.eventTypeId, guest: { email, name: "Борис" }, startAt });
  expectMatchesSpec(response, "post", "/api/calendars/{calendarSlug}/bookings");
  return response;
};

const listSlots = async (owner: Owner): Promise<Slot[]> => {
  const response = await request(httpServer(runningApp()))
    .get(`/api/calendars/${owner.slug}/slots`)
    .query({ ...wideRange, eventTypeId: owner.eventTypeId });
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}/slots");
  expect(response.status).toBe(200);
  return slotsOf(response);
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(testAppOptions(database.getConnectionUri(), { now: () => now }));
  await app.init();
});

beforeEach(() => {
  now = aucklandMorning;
});

afterAll(async () => {
  if (app !== undefined) {
    await app.close();
  }
  if (database !== undefined) {
    await database.stop();
  }
});

const expectCreated = (response: request.Response): void => {
  expect(response.status).toBe(201);
};

const expectLimited = (response: request.Response): void => {
  expect(response.status).toBe(409);
  expect(problemCode(response)).toBe("daily_limit_reached");
};

const expectNextOwnerDay = async (): Promise<void> => {
  const nextDay = await registerOwner(auckland);
  await writeLimit(nextDay, limitOfOne);
  const endOfDay = await book(nextDay, lastSlot, "boris@example.com");
  const startOfNext = await book(nextDay, nextAucklandDay, "boris@example.com");
  expectCreated(endOfDay);
  expectCreated(startOfNext);
};

const bookUpToTheLimit = async (owner: Owner): Promise<void> => {
  const first = await book(owner, lateAfternoon, "boris@example.com");
  const second = await book(owner, lastSlot, "boris@example.com");
  expectCreated(first);
  expectCreated(second);
};

describe("Лимит бронирований", () => {
  it("rejects a second Бронирование of the same email on the same day once the limit is one", async () => {
    const owner = await registerOwner(auckland);
    await writeLimit(owner, limitOfOne);
    const first = await book(owner, lateAfternoon, "boris@example.com");
    const second = await book(owner, lastSlot, "boris@example.com");

    expectCreated(first);
    expectLimited(second);
  });

  it("treats a different register of the same email as the same Гость", async () => {
    const owner = await registerOwner(auckland);
    await writeLimit(owner, limitOfOne);
    const first = await book(owner, lateAfternoon, "Boris@Example.com");
    const second = await book(owner, lastSlot, "boris@example.com");
    const otherGuest = await book(owner, earlierSlot, "vera@example.com");

    expectCreated(first);
    expectLimited(second);
    expectCreated(otherGuest);
  });
});

describe("the civil day of the Владелец", () => {
  it("counts the day in the Владелец's zone when a UTC midnight falls between two Слоты", async () => {
    const owner = await registerOwner(auckland);
    await writeLimit(owner, limitOfOne);
    const beforeMidnight = await book(owner, aucklandMorningSlot, "boris@example.com");
    const afterMidnight = await book(owner, lastSlot, "boris@example.com");

    expectCreated(beforeMidnight);
    expectLimited(afterMidnight);
    await expectNextOwnerDay();
  });
});

describe("parallel Бронирования and a smaller limit", () => {
  it("lets exactly the limit through when one email books the same day in parallel", async () => {
    const owner = await registerOwner(auckland);
    await writeLimit(owner, parallelLimit);
    const responses = await Promise.all(
      sameDaySlots.map(async (startAt) => {
        const response = await book(owner, startAt, "boris@example.com");
        return response;
      }),
    );
    const created = responses.filter((response) => response.status === 201);
    const limited = responses.filter(
      (response) => response.status === 409 && problemCode(response) === "daily_limit_reached",
    );

    expect(created).toHaveLength(parallelLimit);
    expect(limited).toHaveLength(sameDaySlots.length - parallelLimit);
  });

  it("keeps existing Бронирования when the Лимит бронирований shrinks", async () => {
    const owner = await registerOwner(auckland);
    await writeLimit(owner, parallelLimit);
    await bookUpToTheLimit(owner);
    await writeLimit(owner, limitOfOne);
    const slots = await listSlots(owner);
    const third = await book(owner, earlierSlot, "boris@example.com");

    expect(slots).toContainEqual({ startAt: lateAfternoon, status: "booked" });
    expect(slots).toContainEqual({ startAt: lastSlot, status: "booked" });
    expectLimited(third);
  });
});
