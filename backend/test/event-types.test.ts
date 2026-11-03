import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAdmin as admin, testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

const foreignTypeId = "11111111-1111-4111-8111-111111111111";
const tomorrowAtTen = "2026-11-03T07:00:00.000Z";
const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
// oxlint-disable-next-line eslint/no-magic-numbers -- 45 is not a multiple of 30
const offStepMinutes = 45;
// oxlint-disable-next-line eslint/no-magic-numbers -- the shortest Тип события
const halfHourMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- one hour still fits before 18:00
const hourMinutes = 60;

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

interface Owner {
  cookie: string;
  slug: string;
}

const registerOwner = async (): Promise<Owner> => {
  sequence += 1;
  const slug = `types-${sequence}`;
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone: "Europe/Moscow",
    })
    .expect(201);
  return { cookie: sessionPair(response.headers["set-cookie"]), slug };
};

const adminCookie = async (): Promise<string> => {
  const response = await request(httpServer(runningApp())).post("/api/auth/login").send(admin);
  expectMatchesSpec(response, "post", "/api/auth/login");
  expect(response.status).toBe(200);
  return sessionPair(response.headers["set-cookie"]);
};

const listTypes = async (cookie?: string): Promise<request.Response> => {
  const pending = request(httpServer(runningApp())).get("/api/owner/event-types");
  if (cookie !== undefined) {
    pending.set("Cookie", cookie);
  }
  const response = await pending;
  expectMatchesSpec(response, "get", "/api/owner/event-types");
  return response;
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

describe("who may open a Тип события", () => {
  it("rejects a guest", async () => {
    const guest = await request(httpServer(runningApp())).get("/api/owner/event-types");
    const created = await request(httpServer(runningApp())).post("/api/owner/event-types").send({
      description: "Короткий звонок",
      durationMinutes: halfHourMinutes,
      name: "Звонок",
    });
    expectMatchesSpec(guest, "get", "/api/owner/event-types");
    expectMatchesSpec(created, "post", "/api/owner/event-types");
    expect(guest.status).toBe(401);
    expect(created.status).toBe(401);
  });

  it("rejects an Администратор", async () => {
    const cookie = await adminCookie();
    const listed = await listTypes(cookie);
    const denied = await request(httpServer(runningApp()))
      .post("/api/owner/event-types")
      .set("Cookie", cookie)
      .send({
        description: "Короткий звонок",
        durationMinutes: halfHourMinutes,
        name: "Звонок",
      });
    expectMatchesSpec(denied, "post", "/api/owner/event-types");
    expect(listed.status).toBe(403);
    expect(denied.status).toBe(403);
  });
});

describe("creating a Тип события", () => {
  it("rejects a duration that is not a 30-minute step", async () => {
    const owner = await registerOwner();
    const response = await request(httpServer(runningApp()))
      .post("/api/owner/event-types")
      .set("Cookie", owner.cookie)
      .send({
        description: "Короткий звонок",
        durationMinutes: offStepMinutes,
        name: "Звонок",
      });
    expectMatchesSpec(response, "post", "/api/owner/event-types");
    expect(response.status).toBe(400);
    expect(problemCode(response)).toBe("validation_failed");
  });
});

describe("a published Тип события", () => {
  it("lists created types on the public Календарь, in creation order", async () => {
    const owner = await registerOwner();
    const hourId = await openEventType(runningApp(), owner.cookie, {
      description: "Часовой созвон",
      durationMinutes: hourMinutes,
      name: "Час",
    });
    const halfHourId = await openEventType(runningApp(), owner.cookie, {
      description: "Короткий звонок",
      durationMinutes: halfHourMinutes,
      name: "Звонок",
    });

    const listed = await listTypes(owner.cookie);
    const eventTypes = [
      {
        description: "Часовой созвон",
        durationMinutes: hourMinutes,
        id: hourId,
        name: "Час",
      },
      {
        description: "Короткий звонок",
        durationMinutes: halfHourMinutes,
        id: halfHourId,
        name: "Звонок",
      },
    ];
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ eventTypes });

    const calendar = await request(httpServer(runningApp())).get(`/api/calendars/${owner.slug}`);
    expectMatchesSpec(calendar, "get", "/api/calendars/{calendarSlug}");
    expect(calendar.body).toMatchObject({ eventTypes });
  });
});

describe("a missing Тип события", () => {
  it("answers event_type_not_found for an id from another Календарь", async () => {
    const owner = await registerOwner();
    await openEventType(runningApp(), owner.cookie, { durationMinutes: halfHourMinutes });
    const slots = await request(httpServer(runningApp()))
      .get(`/api/calendars/${owner.slug}/slots`)
      .query({ ...wideRange, eventTypeId: foreignTypeId });
    const booking = await request(httpServer(runningApp()))
      .post(`/api/calendars/${owner.slug}/bookings`)
      .send({
        eventTypeId: foreignTypeId,
        guest: { email: "boris@example.com", name: "Борис" },
        startAt: tomorrowAtTen,
      });
    expectMatchesSpec(slots, "get", "/api/calendars/{calendarSlug}/slots");
    expectMatchesSpec(booking, "post", "/api/calendars/{calendarSlug}/bookings");
    expect(slots.status).toBe(404);
    expect(booking.status).toBe(404);
    expect(problemCode(slots)).toBe("event_type_not_found");
    expect(problemCode(booking)).toBe("event_type_not_found");
  });
});

describe("a Календарь without a Тип события", () => {
  it("publishes an empty list and refuses a booking when no type exists", async () => {
    const owner = await registerOwner();
    const calendar = await request(httpServer(runningApp())).get(`/api/calendars/${owner.slug}`);
    expectMatchesSpec(calendar, "get", "/api/calendars/{calendarSlug}");
    expect(calendar.body).toMatchObject({ eventTypes: [] });

    const booking = await request(httpServer(runningApp()))
      .post(`/api/calendars/${owner.slug}/bookings`)
      .send({
        eventTypeId: foreignTypeId,
        guest: { email: "boris@example.com", name: "Борис" },
        startAt: tomorrowAtTen,
      });
    expectMatchesSpec(booking, "post", "/api/calendars/{calendarSlug}/bookings");
    expect(booking.status).toBe(404);
    expect(problemCode(booking)).toBe("event_type_not_found");
  });
});
