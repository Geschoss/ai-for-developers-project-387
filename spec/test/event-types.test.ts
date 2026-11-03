import request from "supertest";
import { describe, it } from "vitest";

import { contractApp, session } from "./app.ts";

const app = contractApp();
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the shortest Тип события is 30 minutes
const shortestMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the longest Тип события is 540 minutes
const longestMinutes = 540;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a name is at most 100 characters
const nameOverLimit = 101;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a description is at most 1000 characters
const descriptionOverLimit = 1001;
const draft = {
  description: "Короткий звонок",
  durationMinutes: shortestMinutes,
  name: "Звонок",
};

describe("listEventTypes", () => {
  it("requires a session", async () => {
    await request(app).get("/api/owner/event-types").expect(401);
  });

  it("passes with a session", async () => {
    await request(app).get("/api/owner/event-types").set("Cookie", session).expect(200);
  });
});

describe("createEventType", () => {
  it("requires a session", async () => {
    await request(app).post("/api/owner/event-types").send(draft).expect(401);
  });

  it.each([shortestMinutes, longestMinutes])(
    "accepts a duration of %i minutes",
    async (durationMinutes) => {
      await request(app)
        .post("/api/owner/event-types")
        .set("Cookie", session)
        .send({ ...draft, durationMinutes })
        .expect(200);
    },
  );

  it.each([
    { durationMinutes: 0 },
    { durationMinutes: 15 },
    { durationMinutes: 45 },
    { durationMinutes: 570 },
    { name: "" },
    { name: "а".repeat(nameOverLimit) },
    { description: "" },
    { description: "а".repeat(descriptionOverLimit) },
  ])("rejects %j", async (change) => {
    await request(app)
      .post("/api/owner/event-types")
      .set("Cookie", session)
      .send({ ...draft, ...change })
      .expect(400);
  });
});
