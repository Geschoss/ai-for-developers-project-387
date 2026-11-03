import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import type { components } from "spec/api";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAdmin as admin, testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a horizon of 14 days
const defaultPlanningHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a limit of 2
const defaultDailyBookingLimit = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: Горизонт планирования is at most 60 days
const maxPlanningHorizonDays = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: Лимит бронирований is at most 18
const maxDailyBookingLimit = 18;

type OwnerSettings = components["schemas"]["OwnerSettings"];

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

let sequence = 0;

const registerOwner = async (timeZone = "Europe/Moscow"): Promise<string> => {
  sequence += 1;
  const slug = `owner-${sequence}`;
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone,
    })
    .expect(201);
  return sessionPair(response.headers["set-cookie"]);
};

const adminCookie = async (): Promise<string> => {
  const response = await request(httpServer(runningApp())).post("/api/auth/login").send(admin);
  expectMatchesSpec(response, "post", "/api/auth/login");
  expect(response.status).toBe(200);
  return sessionPair(response.headers["set-cookie"]);
};

const readSettings = async (cookie?: string): Promise<request.Response> => {
  const pending = request(httpServer(runningApp())).get("/api/owner/settings");
  if (cookie !== undefined) {
    pending.set("Cookie", cookie);
  }
  const response = await pending;
  expectMatchesSpec(response, "get", "/api/owner/settings");
  return response;
};

const writeSettings = async (
  cookie: string | undefined,
  body: OwnerSettings,
): Promise<request.Response> => {
  const pending = request(httpServer(runningApp())).put("/api/owner/settings").send(body);
  if (cookie !== undefined) {
    pending.set("Cookie", cookie);
  }
  const response = await pending;
  expectMatchesSpec(response, "put", "/api/owner/settings");
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

const defaults = (timeZone: string): OwnerSettings => ({
  dailyBookingLimit: defaultDailyBookingLimit,
  planningHorizonDays: defaultPlanningHorizonDays,
  timeZone,
});

describe("GET /api/owner/settings", () => {
  it("answers 401 without a session", async () => {
    const response = await readSettings();

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "unauthenticated" });
  });

  it("answers 403 to the Администратор", async () => {
    const response = await readSettings(await adminCookie());

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "forbidden", status: 403, title: "Forbidden" });
  });

  it("returns the defaults a new Владелец was registered with", async () => {
    const cookie = await registerOwner("Asia/Tokyo");

    const response = await readSettings(cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(defaults("Asia/Tokyo"));
  });
});

const saved: OwnerSettings = {
  dailyBookingLimit: maxDailyBookingLimit,
  planningHorizonDays: maxPlanningHorizonDays,
  timeZone: "UTC",
};

const shrunk: OwnerSettings = {
  dailyBookingLimit: 1,
  planningHorizonDays: 1,
  timeZone: "Europe/Moscow",
};

const outsideRange: OwnerSettings[] = [
  { dailyBookingLimit: defaultDailyBookingLimit, planningHorizonDays: 0, timeZone: "UTC" },
  {
    dailyBookingLimit: defaultDailyBookingLimit,
    planningHorizonDays: maxPlanningHorizonDays + 1,
    timeZone: "UTC",
  },
  { dailyBookingLimit: 0, planningHorizonDays: defaultPlanningHorizonDays, timeZone: "UTC" },
  {
    dailyBookingLimit: maxDailyBookingLimit + 1,
    planningHorizonDays: defaultPlanningHorizonDays,
    timeZone: "UTC",
  },
];

const expectRoundTrip = (responses: {
  afterShrink: request.Response;
  again: request.Response;
  untouched: request.Response;
  written: request.Response;
}): void => {
  expect(responses.written.status).toBe(200);
  expect(responses.written.body).toEqual(saved);
  expect(responses.again.body).toEqual(saved);
  expect(responses.untouched.body).toEqual(defaults("Asia/Tokyo"));
  expect(responses.afterShrink.status).toBe(200);
  expect(responses.afterShrink.body).toEqual(shrunk);
};

const registerNamed = async (): Promise<{ cookie: string; slug: string }> => {
  sequence += 1;
  const slug = `identity-${sequence}`;
  const registered = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone: "Europe/Moscow",
    })
    .expect(201);
  return { cookie: sessionPair(registered.headers["set-cookie"]), slug };
};

describe("PUT /api/owner/settings", () => {
  it("answers 401 without a session", async () => {
    const response = await writeSettings(undefined, saved);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "unauthenticated" });
  });

  it("answers 403 to the Администратор", async () => {
    const response = await writeSettings(await adminCookie(), saved);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "forbidden", status: 403, title: "Forbidden" });
  });

  it("saves the settings and shows them on the next read, including after they shrink", async () => {
    const cookie = await registerOwner();
    const other = await registerOwner("Asia/Tokyo");
    const written = await writeSettings(cookie, saved);
    const again = await readSettings(cookie);
    const untouched = await readSettings(other);
    const afterShrink = await writeSettings(cookie, shrunk);

    expectRoundTrip({ afterShrink, again, untouched, written });
  });

  it("keeps the Владелец's identity and reports the new time zone from the session", async () => {
    const { cookie, slug } = await registerNamed();
    await writeSettings(cookie, saved);
    const me = await request(httpServer(runningApp())).get("/api/auth/me").set("Cookie", cookie);
    expectMatchesSpec(me, "get", "/api/auth/me");

    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      role: "owner",
      timeZone: "UTC",
    });
  });
});

describe("PUT /api/owner/settings validation", () => {
  it.each(outsideRange)("rejects %j as validation_failed", async (body) => {
    const response = await writeSettings(await registerOwner(), body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: "validation_failed", status: 400 });
  });

  it("rejects an unknown time zone", async () => {
    const response = await writeSettings(await registerOwner(), {
      ...defaults("Europe/Moscow"),
      timeZone: "Europe/NotARealCity",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "validation_failed",
      issues: [{ path: "/body/timeZone" }],
      status: 400,
    });
  });
});
