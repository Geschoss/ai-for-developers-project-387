import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;
// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let app: INestApplication | undefined = undefined;

const startedDatabase = (): StartedPostgreSqlContainer => {
  if (database === undefined) {
    throw new Error("Postgres was not started");
  }
  return database;
};

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const runningApp = (): INestApplication => {
  if (app === undefined) {
    throw new Error("The app was not started");
  }
  return app;
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

describe("GET /api/health", () => {
  it("answers 200 as the spec describes", async () => {
    const response = await request(httpServer(runningApp())).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expectMatchesSpec(response, "get", "/api/health");
  });
});

describe("startup", () => {
  it("applies migrations", async () => {
    const client = new Client({ connectionString: startedDatabase().getConnectionUri() });
    await client.connect();
    try {
      const { rows } = await client.query<{ applied: number }>(
        "select count(*)::int as applied from drizzle.__drizzle_migrations",
      );
      const [first] = rows;
      if (first === undefined) {
        throw new Error("migration count missing");
      }
      expect(first.applied).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });
});

describe("a request that breaks the spec", () => {
  it("gets 400 problem+json naming the offending field", async () => {
    const response = await request(httpServer(runningApp())).post("/api/auth/register").send({
      calendarSlug: "anna",
      email: "not-an-email",
      name: "Анна",
      password: "long-enough",
      timeZone: "UTC",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "validation_failed",
      issues: [expect.objectContaining({ path: "/body/email" })],
      status: 400,
    });
    expectMatchesSpec(response, "post", "/api/auth/register");
  });
});

describe("paths outside /api", () => {
  it.each(["/", "/u/anna", "/register"])("serve the SPA at %s", async (path) => {
    const response = await request(httpServer(runningApp())).get(path);

    expect(response.status).toBe(200);
    expect(response.text).toContain("<title>SPA</title>");
  });

  it("do not swallow unknown API paths", async () => {
    const response = await request(httpServer(runningApp())).get("/api/nope");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/u);
  });
});
