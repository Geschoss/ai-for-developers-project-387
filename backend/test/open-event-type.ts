import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { expect } from "vitest";

import { expectMatchesSpec } from "./contract.js";

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

interface OpenedEventType {
  description?: string;
  durationMinutes: number;
  name?: string;
}

/** Creates a Тип события for the signed-in Владелец and returns its id. */
const openEventType = async (
  application: INestApplication,
  cookie: string,
  eventType: OpenedEventType,
): Promise<string> => {
  const response = await request(httpServer(application))
    .post("/api/owner/event-types")
    .set("Cookie", cookie)
    .send({
      description: eventType.description ?? "Короткий звонок",
      durationMinutes: eventType.durationMinutes,
      name: eventType.name ?? "Звонок",
    });
  expectMatchesSpec(response, "post", "/api/owner/event-types");
  expect(response.status).toBe(201);
  const body: unknown = response.body;
  if (!isRecord(body) || typeof body["id"] !== "string") {
    throw new Error("Тип события response has no id");
  }
  return body["id"];
};

export { openEventType };
