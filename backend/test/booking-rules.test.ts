import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
const guestName = "Борис";
const auckland = "Pacific/Auckland";
/**
 * 2026-11-03 01:00 in Pacific/Auckland (NZDT, UTC+13). UTC is still 2 November, so a check that uses the UTC
 * date would treat the Владелец's today as already over.
 */
const aucklandMorning = new Date("2026-11-02T12:00:00.000Z");
/** 17:30 on that Auckland day: the last Слот of the Горизонт планирования when it is one day. */
const lastSlotOfAucklandToday = "2026-11-03T04:30:00.000Z";
/** 09:00 the next Auckland day: the first Слот after a one-day horizon. */
const firstSlotAfterAucklandToday = "2026-11-03T20:00:00.000Z";
/** 09:00 on the Auckland day before `aucklandMorning`. */
const previousAucklandDay = "2026-11-01T20:00:00.000Z";
/** 17:30 Europe/Moscow on 2026-11-02, later than `aucklandMorning` and on the owner's grid. */
const moscowAfternoon = "2026-11-02T14:30:00.000Z";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a limit of 2
const defaultDailyBookingLimit = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- today and the next day
const twoDayHorizon = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid these tests book is 30 minutes
const halfHourMinutes = 30;

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
  const slug = `rules-${sequence}`;
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

const writeHorizon = async (
  owner: Owner,
  planningHorizonDays: number,
  timeZone: string,
): Promise<void> => {
  const response = await request(httpServer(runningApp()))
    .put("/api/owner/settings")
    .set("Cookie", owner.cookie)
    .send({ dailyBookingLimit: defaultDailyBookingLimit, planningHorizonDays, timeZone });
  expectMatchesSpec(response, "put", "/api/owner/settings");
  expect(response.status).toBe(200);
};

const book = async (owner: Owner, startAt: string, cookie?: string): Promise<request.Response> => {
  const pending = request(httpServer(runningApp()))
    .post(`/api/calendars/${owner.slug}/bookings`)
    .send({
      eventTypeId: owner.eventTypeId,
      guest: { email: "boris@example.com", name: guestName },
      startAt,
    });
  if (cookie !== undefined) {
    pending.set("Cookie", cookie);
  }
  const response = await pending;
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

describe("booking rules", () => {
  it.each([
    [lastSlotOfAucklandToday, "a Слот that starts at the current instant"],
    [previousAucklandDay, "a Слот on a previous day in the Владелец's zone"],
  ])("rejects %s (%s) as slot_in_past", async (startAt) => {
    now = new Date(lastSlotOfAucklandToday);
    const owner = await registerOwner(auckland);
    const response = await book(owner, startAt);

    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe("slot_in_past");
  });

  it("accepts the last day of the Горизонт планирования in the Владелец's zone and rejects the next", async () => {
    const owner = await registerOwner(auckland);
    await writeHorizon(owner, 1, auckland);
    const lastDay = await book(owner, lastSlotOfAucklandToday);
    const nextDay = await book(owner, firstSlotAfterAucklandToday);

    expect(lastDay.status).toBe(201);
    expect(lastDay.body).toMatchObject({ startAt: lastSlotOfAucklandToday });
    expect(nextDay.status).toBe(422);
    expect(problemCode(nextDay)).toBe("outside_planning_horizon");
  });

  it("keeps a Бронирование that falls outside the Горизонт планирования after the horizon shrinks", async () => {
    const owner = await registerOwner(auckland);
    await writeHorizon(owner, twoDayHorizon, auckland);
    const booked = await book(owner, firstSlotAfterAucklandToday);
    expect(booked.status).toBe(201);
    await writeHorizon(owner, 1, auckland);
    await writeHorizon(owner, twoDayHorizon, auckland);

    const slots = await listSlots(owner);
    expect(slots).toContainEqual({ startAt: firstSlotAfterAucklandToday, status: "booked" });
  });

  it("rejects the Владелец's own calendar and lets that session book someone else's", async () => {
    const owner = await registerOwner("Europe/Moscow");
    const other = await registerOwner("Europe/Moscow");
    const own = await book(owner, moscowAfternoon, owner.cookie);
    const foreign = await book(other, moscowAfternoon, owner.cookie);

    expect(own.status).toBe(422);
    expect(problemCode(own)).toBe("own_calendar");
    expect(foreign.status).toBe(201);
    expect(foreign.body).toMatchObject({ ownerName: "Анна", startAt: moscowAfternoon });
  });
});
