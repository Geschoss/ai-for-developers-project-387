import request from "supertest";
import { describe, it } from "vitest";

import { contractApp, session } from "./app.ts";

const app = contractApp(),
  settings = { dailyBookingLimit: 2, planningHorizonDays: 14, timeZone: "Asia/Yekaterinburg" };

describe("getOwnerSettings", () => {
  it("requires a session", async () => {
    await request(app).get("/api/owner/settings").expect(401);
  });

  it("passes with a session", async () => {
    await request(app).get("/api/owner/settings").set("Cookie", session).expect(200);
  });
});

describe("updateOwnerSettings", () => {
  it("requires a session", async () => {
    await request(app).put("/api/owner/settings").send(settings).expect(401);
  });

  it.each([
    { dailyBookingLimit: 1, planningHorizonDays: 1 },
    { dailyBookingLimit: 18, planningHorizonDays: 60 },
  ])("accepts boundary values %j", async (bounds) => {
    await request(app)
      .put("/api/owner/settings")
      .set("Cookie", session)
      .send({ ...settings, ...bounds })
      .expect(200);
  });

  it.each([
    { planningHorizonDays: 0 },
    { planningHorizonDays: 61 },
    { planningHorizonDays: 1.5 },
    { dailyBookingLimit: 0 },
    { dailyBookingLimit: 19 },
    { timeZone: "Europe/Moscow; drop table" },
    { timeZone: undefined },
  ])("rejects %j", async (change) => {
    await request(app)
      .put("/api/owner/settings")
      .set("Cookie", session)
      .send({ ...settings, ...change })
      .expect(400);
  });
});
