import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAdmin as admin, testAppOptions } from "./app-options.js";
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

const startedDatabase = (): StartedPostgreSqlContainer => {
  if (database === undefined) {
    throw new Error("Postgres was not started");
  }
  return database;
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

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(testAppOptions(startedDatabase().getConnectionUri()));
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

const logIn = async (
  application: INestApplication,
  credentials: { email: string; password: string },
): Promise<request.Response> => {
  const response = await request(httpServer(application)).post("/api/auth/login").send(credentials);
  expectMatchesSpec(response, "post", "/api/auth/login");
  return response;
};

describe("Администратор at startup", () => {
  it("is created from the configured credentials and logs in as admin", async () => {
    const response = await logIn(runningApp(), admin);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ email: admin.email, role: "admin" });
  });

  it("survives a restart with the same credentials", async () => {
    const restarted = await createApp(testAppOptions(startedDatabase().getConnectionUri()));
    await restarted.init();
    try {
      const response = await logIn(restarted, admin);
      expect(response.status).toBe(200);
    } finally {
      await restarted.close();
    }
  });

  it("is not created a second time when the configured email changes", async () => {
    const other = { email: "other-admin@example.com", password: "admin-password" };
    const restarted = await createApp(
      testAppOptions(startedDatabase().getConnectionUri(), { admin: other }),
    );
    await restarted.init();
    try {
      const response = await logIn(restarted, other);
      expect(response.status).toBe(401);
    } finally {
      await restarted.close();
    }
  });
});

const listOwners = async (cookie?: string): Promise<request.Response> => {
  const pending = request(httpServer(runningApp())).get("/api/admin/owners");
  if (cookie !== undefined) {
    pending.set("Cookie", cookie);
  }
  const response = await pending;
  expectMatchesSpec(response, "get", "/api/admin/owners");
  return response;
};

const registerOwner = async (slug: string): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: `Владелец ${slug}`,
      password: "long-enough",
      timeZone: "Asia/Tokyo",
    })
    .expect(201);
  return response;
};

describe("GET /api/admin/owners", () => {
  it("answers 401 without a session", async () => {
    const response = await listOwners();

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "unauthenticated" });
  });

  it("answers 403 to an owner", async () => {
    const registered = await registerOwner("forbidden-owner");

    const response = await listOwners(sessionPair(registered.headers["set-cookie"]));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "forbidden", status: 403, title: "Forbidden" });
  });

  it("lists owners oldest first to the admin, without the admin", async () => {
    await registerOwner("first-listed");
    await registerOwner("second-listed");
    const loggedIn = await logIn(runningApp(), admin);

    const response = await listOwners(sessionPair(loggedIn.headers["set-cookie"]));

    expect(response.status).toBe(200);
    // Startup seeds the demo Владелец, then the 403 test registered `forbidden-owner`.
    // The admin is never listed. `toMatchObject` demands this order; the contract check covers `registeredAt`.
    expect(response.body).toMatchObject({
      owners: [
        {
          calendarSlug: "demo",
          email: "demo@example.com",
          name: "Демо",
          timeZone: "Europe/Moscow",
        },
        ...["forbidden-owner", "first-listed", "second-listed"].map((slug) => ({
          calendarSlug: slug,
          email: `${slug}@example.com`,
          name: `Владелец ${slug}`,
          timeZone: "Asia/Tokyo",
        })),
      ],
    });
  });
});
