import request from "supertest";
import { describe, it } from "vitest";

import { contractApp, session } from "./app.ts";

const app = contractApp();

describe.each(["/api/owner/bookings", "/api/admin/owners"])("GET %s", (path) => {
  it("requires a session", async () => {
    await request(app).get(path).expect(401);
  });

  it("passes with a session", async () => {
    await request(app).get(path).set("Cookie", session).expect(200);
  });
});
