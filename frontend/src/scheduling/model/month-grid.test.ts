import { describe, expect, it } from "vitest";

import { canShiftMonth } from "./month-grid";

describe("month shift within the horizon", () => {
  const earliest = { month: 10, year: 2026 };
  const latest = { month: 11, year: 2026 };

  it("allows the previous month only while a horizon day remains there", () => {
    expect(canShiftMonth({ month: 11, year: 2026 }, earliest, -1)).toBe(true);
    expect(canShiftMonth(earliest, earliest, -1)).toBe(false);
  });

  it("allows the next month only while a horizon day remains there", () => {
    expect(canShiftMonth({ month: 10, year: 2026 }, latest, 1)).toBe(true);
    expect(canShiftMonth(latest, latest, 1)).toBe(false);
  });
});
