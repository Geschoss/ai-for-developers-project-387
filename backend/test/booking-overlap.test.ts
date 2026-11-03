import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

/** 2026-11-10 00:00 in Europe/Moscow, before the grid. 10:00 that day is still ahead. */
const morning = new Date("2026-11-09T21:00:00.000Z");
/** 10:00 Europe/Moscow on 2026-11-10. */
const ten = "2026-11-10T07:00:00.000Z";
/** 10:30 that day. */
const tenThirty = "2026-11-10T07:30:00.000Z";
/** 11:00 that day: the abutment after a 60-minute Бронирование from 10:00. */
const eleven = "2026-11-10T08:00:00.000Z";
// oxlint-disable-next-line eslint/no-magic-numbers -- the longer Тип события in the overlap example
const hourMinutes = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- the shorter Тип события in the overlap example
const halfHourMinutes = 30;

interface Owner {
  cookie: string;
  halfHourId: string;
  hourId: string;
  slug: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const problemCode = (response: request.Response): string | undefined => {
  const body: unknown = response.body;
  if (!isRecord(body) || typeof body["code"] !== "string") {
    return undefined;
  }
  return body["code"];
};

let sequence = 0;

const registerOwner = async (): Promise<Owner> => {
  sequence += 1;
  const slug = `overlap-${sequence}`;
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
  const cookie = sessionPair(response.headers["set-cookie"]);
  const hourId = await openEventType(runningApp(), cookie, {
    description: "Часовая встреча",
    durationMinutes: hourMinutes,
    name: "Час",
  });
  const halfHourId = await openEventType(runningApp(), cookie, {
    description: "Короткий звонок",
    durationMinutes: halfHourMinutes,
    name: "Полчаса",
  });
  return { cookie, halfHourId, hourId, slug };
};

interface BookedGuest {
  email: string;
  eventTypeId: string;
  startAt: string;
}

const book = async (owner: Owner, guest: BookedGuest): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .post(`/api/calendars/${owner.slug}/bookings`)
    .send({
      eventTypeId: guest.eventTypeId,
      guest: { email: guest.email, name: "Борис" },
      startAt: guest.startAt,
    });
  expectMatchesSpec(response, "post", "/api/calendars/{calendarSlug}/bookings");
  return response;
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(testAppOptions(database.getConnectionUri(), { now: () => morning }));
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

const expectOneWinner = (responses: request.Response[]): void => {
  const created = responses.filter((response) => response.status === 201);
  const rejected = responses.filter((response) => response.status === 409);
  expect(created).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  const [lost] = rejected;
  if (lost === undefined) {
    throw new Error("one overlapping booking must be refused");
  }
  expect(problemCode(lost)).toBe("slot_taken");
};

describe("пересечение Бронирований разных Типов событий", () => {
  it("rejects 30 minutes at 10:30 after 60 minutes at 10:00 and accepts 11:00", async () => {
    const owner = await registerOwner();
    const taken = await book(owner, {
      email: "hour@example.com",
      eventTypeId: owner.hourId,
      startAt: ten,
    });
    const overlap = await book(owner, {
      email: "overlap@example.com",
      eventTypeId: owner.halfHourId,
      startAt: tenThirty,
    });
    const abutment = await book(owner, {
      email: "abutment@example.com",
      eventTypeId: owner.halfHourId,
      startAt: eleven,
    });

    expect(taken.status).toBe(201);
    expect(overlap.status).toBe(409);
    expect(problemCode(overlap)).toBe("slot_taken");
    expect(abutment.status).toBe(201);
    expect(abutment.body).toMatchObject({ startAt: eleven });
  });

  it("gives an overlapping pair to exactly one of two simultaneous Гости", async () => {
    const owner = await registerOwner();
    const responses = await Promise.all([
      book(owner, { email: "hour@example.com", eventTypeId: owner.hourId, startAt: ten }),
      book(owner, { email: "half@example.com", eventTypeId: owner.halfHourId, startAt: tenThirty }),
    ]);
    expectOneWinner(responses);
  });
});
