import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";

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

interface Registration {
  calendarSlug: string;
  email: string;
  name: string;
  password: string;
  timeZone: string;
}

let sequence = 0;

/** A registration the contract accepts. Each call uses a fresh email and Адрес календаря. */
const registration = (overrides: Partial<Registration> = {}): Registration => {
  sequence += 1;
  return {
    calendarSlug: `anna-${sequence}`,
    email: `anna-${sequence}@example.com`,
    name: "Анна",
    password: "long-enough",
    timeZone: "Europe/Moscow",
    ...overrides,
  };
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

const expectOwner = (response: request.Response, body: Registration): void => {
  expect(response.body).toEqual({
    calendarSlug: body.calendarSlug,
    email: body.email,
    name: body.name,
    role: "owner",
    timeZone: body.timeZone,
  });
};

const plainSessionCookie = /^sid=[0-9a-f-]{36}; HttpOnly; SameSite=Lax; Path=\/; Max-Age=\d+$/u;

describe("POST /api/auth/register", () => {
  it("creates an owner and logs them in", async () => {
    const body = registration();
    const response = await request(httpServer(runningApp())).post("/api/auth/register").send(body);
    expect(response.status).toBe(201);
    expectOwner(response, body);
    expect(response.headers["set-cookie"]).toEqual([expect.stringMatching(plainSessionCookie)]);
    expectMatchesSpec(response, "post", "/api/auth/register");

    const me = await request(httpServer(runningApp()))
      .get("/api/auth/me")
      .set("Cookie", sessionPair(response.headers["set-cookie"]));
    expect(me.status).toBe(200);
    expect(me.body).toEqual(response.body);
    expectMatchesSpec(me, "get", "/api/auth/me");
  });

  it("rejects a second owner with the same email in another case", async () => {
    const body = registration();
    const mixedCaseEmail = body.email.replace("anna", "Anna").replace("example.com", "Example.com");
    const created = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .send({ ...body, email: mixedCaseEmail });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ email: body.email });
    expectMatchesSpec(created, "post", "/api/auth/register");

    const conflict = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .send(registration({ email: mixedCaseEmail }));

    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ code: "email_taken", status: 409, title: "Conflict" });
    expectMatchesSpec(conflict, "post", "/api/auth/register");
  });
});

describe("POST /api/auth/register conflicts", () => {
  it("rejects a second owner with the same calendar slug", async () => {
    const body = registration();
    await request(httpServer(runningApp())).post("/api/auth/register").send(body).expect(201);

    const conflict = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .send(registration({ calendarSlug: body.calendarSlug }));

    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ code: "slug_taken", status: 409, title: "Conflict" });
    expectMatchesSpec(conflict, "post", "/api/auth/register");
  });

  it("reports email_taken when both the email and the calendar slug are taken", async () => {
    const first = registration();
    const second = registration();
    await request(httpServer(runningApp())).post("/api/auth/register").send(first).expect(201);
    await request(httpServer(runningApp())).post("/api/auth/register").send(second).expect(201);

    const conflict = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .send(
        registration({
          calendarSlug: second.calendarSlug,
          email: first.email.toUpperCase(),
        }),
      );

    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({ code: "email_taken" });
    expectMatchesSpec(conflict, "post", "/api/auth/register");
  });
});

describe("POST /api/auth/register validation", () => {
  it("accepts UTC, which Intl.supportedValuesOf omits", async () => {
    const response = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .send(registration({ timeZone: "UTC" }));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ timeZone: "UTC" });
    expectMatchesSpec(response, "post", "/api/auth/register");
  });

  it("rejects an unknown time zone", async () => {
    const response = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .send(registration({ timeZone: "Europe/NotARealCity" }));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "validation_failed",
      issues: [{ path: "/body/timeZone" }],
      status: 400,
    });
    expectMatchesSpec(response, "post", "/api/auth/register");
  });

  it("marks the cookie Secure only when the request arrived over HTTPS", async () => {
    const response = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .set("X-Forwarded-Proto", "https")
      .send(registration());

    expect(response.status).toBe(201);
    expect(response.headers["set-cookie"]).toEqual([
      expect.stringMatching(
        /^sid=[0-9a-f-]{36}; HttpOnly; SameSite=Lax; Path=\/; Max-Age=\d+; Secure$/u,
      ),
    ]);
    expectMatchesSpec(response, "post", "/api/auth/register");
  });
});

describe("POST /api/auth/login", () => {
  it("logs an owner in by email, ignoring case", async () => {
    const body = registration();
    await request(httpServer(runningApp())).post("/api/auth/register").send(body).expect(201);

    const response = await request(httpServer(runningApp()))
      .post("/api/auth/login")
      .send({ email: body.email.toUpperCase(), password: body.password });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      calendarSlug: body.calendarSlug,
      email: body.email,
      name: body.name,
      role: "owner",
      timeZone: body.timeZone,
    });
    expect(response.headers["set-cookie"]).toEqual([expect.stringMatching(plainSessionCookie)]);
    expectMatchesSpec(response, "post", "/api/auth/login");
  });

  it("answers invalid_credentials for a wrong password and for an unknown email, with the same body", async () => {
    const body = registration();
    await request(httpServer(runningApp())).post("/api/auth/register").send(body).expect(201);

    const wrongPassword = await request(httpServer(runningApp()))
      .post("/api/auth/login")
      .send({ email: body.email, password: "not-the-password" });
    const unknownEmail = await request(httpServer(runningApp()))
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: body.password });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      code: "invalid_credentials",
      status: 401,
      title: "Unauthorized",
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expectMatchesSpec(wrongPassword, "post", "/api/auth/login");
    expectMatchesSpec(unknownEmail, "post", "/api/auth/login");
  });
});

const expectLoggedOut = (response: request.Response): void => {
  expect(response.status).toBe(204);
  expect(response.text).toBe("");
  expect(response.headers["set-cookie"]).toEqual([
    expect.stringMatching(/^sid=; HttpOnly; SameSite=Lax; Path=\/; Max-Age=0$/u),
  ]);
  expectMatchesSpec(response, "post", "/api/auth/logout");
};

describe("POST /api/auth/logout", () => {
  it("deletes the session, so the old cookie no longer authenticates", async () => {
    const registered = await request(httpServer(runningApp()))
      .post("/api/auth/register")
      .send(registration());
    const cookie = sessionPair(registered.headers["set-cookie"]);
    const loggedOut = await request(httpServer(runningApp()))
      .post("/api/auth/logout")
      .set("Cookie", cookie);
    expectLoggedOut(loggedOut);

    const me = await request(httpServer(runningApp())).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(401);
    expect(me.body).toMatchObject({ code: "unauthenticated", status: 401 });
    expectMatchesSpec(me, "get", "/api/auth/me");
  });

  it("still answers 204 when there is no session", async () => {
    const response = await request(httpServer(runningApp())).post("/api/auth/logout");

    expect(response.status).toBe(204);
    expectMatchesSpec(response, "post", "/api/auth/logout");
  });
});

describe("GET /api/auth/me", () => {
  it("answers unauthenticated when there is no session", async () => {
    const response = await request(httpServer(runningApp())).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "unauthenticated", status: 401 });
    expectMatchesSpec(response, "get", "/api/auth/me");
  });
});
