import request from "supertest";
import { describe, it } from "vitest";

import { contractApp } from "./app.ts";

const app = contractApp(),
  registration = {
    calendarSlug: "anna-01",
    email: "anna@example.com",
    name: "Анна",
    password: "long-enough",
    timeZone: "Europe/Moscow",
  };

describe("registerOwner", () => {
  it("passes a valid registration", async () => {
    await request(app).post("/api/auth/register").send(registration).expect(200);
  });

  it.each([
    "ab",
    // oxlint-disable-next-line eslint/no-magic-numbers -- one character past the contract's 30-character slug maximum
    "a".repeat(31),
    "Anna",
    "anna_01",
    "анна",
  ])("rejects calendar slug %j", async (calendarSlug) => {
    await request(app)
      .post("/api/auth/register")
      .send({ ...registration, calendarSlug })
      .expect(400);
  });
});
