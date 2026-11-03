import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DailyBookingLimit } from "../src/scheduling/domain/daily-booking-limit.js";
import { PlanningHorizon } from "../src/scheduling/domain/planning-horizon.js";

const identityRegistration = readFileSync(
  fileURLToPath(new URL("../src/identity/accounts.service.ts", import.meta.url)),
  "utf8",
);

describe("opening Календарь", () => {
  it("takes a horizon of 14 and a limit of 2 from Планирование, not from Идентификация", () => {
    // oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Календарь starts with a horizon of 14 days
    expect(PlanningHorizon.opening().days).toBe(14);
    // oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Календарь starts with a limit of 2
    expect(DailyBookingLimit.opening().perDay).toBe(2);
    expect(identityRegistration).not.toMatch(/planningHorizon|dailyBookingLimit|\b14\b/u);
  });
});
