import { describe, expect, it } from "vitest";

import { horizonGuestKeys, withHorizonDays } from "./horizon";
import type { DayGroup } from "./slot-time";

const eveningInMoscow = new Date("2026-11-02T17:00:00.000Z");

describe("horizon days", () => {
  it("includes today in the Владелец's zone after the grid has ended", () => {
    expect(
      horizonGuestKeys({
        guestTimeZone: "Europe/Moscow",
        now: eveningInMoscow,
        ownerTimeZone: "Europe/Moscow",
        planningHorizonDays: 2,
      }),
    ).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("places the owner day on the guest calendar when the zones differ", () => {
    expect(
      horizonGuestKeys({
        guestTimeZone: "Pacific/Honolulu",
        now: eveningInMoscow,
        ownerTimeZone: "Europe/Moscow",
        planningHorizonDays: 1,
      }),
    ).toEqual(["2026-11-01"]);
  });

  it("keeps a day with Слоты and adds a zero count for a day that has none", () => {
    const booked: DayGroup = {
      free: 0,
      slots: [{ startAt: "2026-11-03T06:00:00.000Z", status: "booked" }],
    };
    const filled = withHorizonDays(new Map([["2026-11-03", booked]]), ["2026-11-02", "2026-11-03"]);
    expect(filled.get("2026-11-03")).toBe(booked);
    expect(filled.get("2026-11-02")).toEqual({ free: 0, slots: [] });
  });
});
