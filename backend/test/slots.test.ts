import { describe, expect, it } from "vitest";

import { bookableSlots } from "../src/scheduling/domain/slot-grid.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- 18 Слотов from 09:00 to 17:30
const slotsPerDay = 18;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid starts at 09:00
const firstSlotHour = 9;
// oxlint-disable-next-line eslint/no-magic-numbers -- a Слот is 30 minutes
const slotLengthMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- minutes in an hour
const minutesPerHour = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;
// oxlint-disable-next-line eslint/no-magic-numbers -- DST spring-forward night is 23 hours
const springForwardHours = 23;
// oxlint-disable-next-line eslint/no-magic-numbers -- DST fall-back night is 25 hours
const fallBackHours = 25;
// oxlint-disable-next-line eslint/no-magic-numbers -- hours between Lord Howe 09:00 on the two days
const lordHoweHours = 23;
// oxlint-disable-next-line eslint/no-magic-numbers -- Lord Howe springs forward by 30 minutes
const lordHoweShiftMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- today plus the next day
const todayAndTomorrow = 2;

const hourMs = minutesPerHour * secondsPerMinute * msPerSecond;
const wideFrom = new Date("2020-01-01T00:00:00.000Z");
const wideTo = new Date("2040-01-01T00:00:00.000Z");

interface LocalParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}

const gridMinutes = (): number[] => {
  const minutes: number[] = [];
  for (let index = 0; index < slotsPerDay; index += 1) {
    minutes.push(firstSlotHour * minutesPerHour + index * slotLengthMinutes);
  }
  return minutes;
};

const localParts = (timeZone: string, instant: Date): LocalParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (found === undefined) {
      throw new Error(`Missing ${type}`);
    }
    return Number(found.value);
  };
  return {
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    month: read("month"),
    year: read("year"),
  };
};

const localMinutes = (timeZone: string, instant: Date): number => {
  const parts = localParts(timeZone, instant);
  return parts.hour * minutesPerHour + parts.minute;
};

const expectFullGrid = (timeZone: string, slots: Date[]): void => {
  expect(slots.map((slot) => localMinutes(timeZone, slot))).toEqual(gridMinutes());
};

const firstSlot = (slots: Date[]): Date => {
  const [slot] = slots;
  if (slot === undefined) {
    throw new Error("Expected at least one Слот");
  }
  return slot;
};

const lastSlot = (slots: Date[]): Date => {
  const [slot] = slots.slice(-1);
  if (slot === undefined) {
    throw new Error("Expected at least one Слот");
  }
  return slot;
};

const daySlots = (timeZone: string, now: string, planningHorizonDays = 1): Date[] =>
  bookableSlots({
    durationMinutes: slotLengthMinutes,
    from: wideFrom,
    now: new Date(now),
    planningHorizonDays,
    timeZone,
    to: wideTo,
  });

describe("bookableSlots grid", () => {
  it("returns the 18 Слоты of a normal day in Europe/Moscow", () => {
    const slots = daySlots("Europe/Moscow", "2026-11-02T01:00:00.000Z");

    expectFullGrid("Europe/Moscow", slots);
    expect(firstSlot(slots).toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(lastSlot(slots).toISOString()).toBe("2026-11-02T14:30:00.000Z");
  });

  it("ends a 60-minute Слот at 18:00, so the last start is 17:00", () => {
    // oxlint-disable-next-line eslint/no-magic-numbers -- an hour-long Тип события
    const hourMinutes = 60;
    const slots = bookableSlots({
      durationMinutes: hourMinutes,
      from: wideFrom,
      now: new Date("2026-11-02T01:00:00.000Z"),
      planningHorizonDays: 1,
      timeZone: "Europe/Moscow",
      to: wideTo,
    });

    expect(firstSlot(slots).toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(lastSlot(slots).toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });

  it("keeps the full grid on a weekend", () => {
    const slots = daySlots("Europe/Moscow", "2026-10-31T01:00:00.000Z");

    expectFullGrid("Europe/Moscow", slots);
    expect(firstSlot(slots).toISOString()).toBe("2026-10-31T06:00:00.000Z");
  });

  it("drops a Слот that has just started", () => {
    const slots = daySlots("Europe/Moscow", "2026-11-02T06:00:00.000Z");

    expect(slots).toHaveLength(slotsPerDay - 1);
    expect(firstSlot(slots).toISOString()).toBe("2026-11-02T06:30:00.000Z");
  });
});

describe("bookableSlots horizon and window", () => {
  it("counts today in the Горизонт планирования and stops at its end", () => {
    const late = "2026-11-02T17:00:00.000Z";

    expect(daySlots("Europe/Moscow", late)).toEqual([]);
    const tomorrow = daySlots("Europe/Moscow", late, todayAndTomorrow);
    expectFullGrid("Europe/Moscow", tomorrow);
    expect(firstSlot(tomorrow).toISOString()).toBe("2026-11-03T06:00:00.000Z");
  });

  it("returns Слоты that start in [from, to)", () => {
    const slots = bookableSlots({
      durationMinutes: slotLengthMinutes,
      from: new Date("2026-11-02T06:30:00.000Z"),
      now: new Date("2026-11-02T01:00:00.000Z"),
      planningHorizonDays: 1,
      timeZone: "Europe/Moscow",
      to: new Date("2026-11-02T07:30:00.000Z"),
    });

    expect(slots.map((slot) => slot.toISOString())).toEqual([
      "2026-11-02T06:30:00.000Z",
      "2026-11-02T07:00:00.000Z",
    ]);
  });
});

describe("bookableSlots in America/New_York", () => {
  it("moves 09:00 earlier in UTC when America/New_York springs forward", () => {
    const before = daySlots("America/New_York", "2026-03-07T08:00:00.000Z");
    const after = daySlots("America/New_York", "2026-03-08T08:00:00.000Z");

    expectFullGrid("America/New_York", before);
    expectFullGrid("America/New_York", after);
    expect(firstSlot(before).toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(firstSlot(after).toISOString()).toBe("2026-03-08T13:00:00.000Z");
    expect(firstSlot(after).getTime() - firstSlot(before).getTime()).toBe(
      springForwardHours * hourMs,
    );
  });

  it("moves 09:00 later in UTC when America/New_York falls back", () => {
    const before = daySlots("America/New_York", "2026-10-31T07:00:00.000Z");
    const after = daySlots("America/New_York", "2026-11-01T08:00:00.000Z");

    expectFullGrid("America/New_York", before);
    expectFullGrid("America/New_York", after);
    expect(firstSlot(before).toISOString()).toBe("2026-10-31T13:00:00.000Z");
    expect(firstSlot(after).toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(firstSlot(after).getTime() - firstSlot(before).getTime()).toBe(fallBackHours * hourMs);
  });
});

describe("bookableSlots in Europe/Berlin and Australia/Lord_Howe", () => {
  it("moves 09:00 earlier in UTC when Europe/Berlin springs forward", () => {
    const before = daySlots("Europe/Berlin", "2026-03-28T04:00:00.000Z");
    const after = daySlots("Europe/Berlin", "2026-03-29T04:00:00.000Z");

    expectFullGrid("Europe/Berlin", before);
    expectFullGrid("Europe/Berlin", after);
    expect(firstSlot(before).toISOString()).toBe("2026-03-28T08:00:00.000Z");
    expect(firstSlot(after).toISOString()).toBe("2026-03-29T07:00:00.000Z");
    expect(firstSlot(after).getTime() - firstSlot(before).getTime()).toBe(
      springForwardHours * hourMs,
    );
  });

  it("moves 09:00 by 30 minutes in UTC when Australia/Lord_Howe springs forward", () => {
    const before = daySlots("Australia/Lord_Howe", "2026-10-02T18:00:00.000Z");
    const after = daySlots("Australia/Lord_Howe", "2026-10-03T18:00:00.000Z");
    const gapMs = lordHoweHours * hourMs + lordHoweShiftMinutes * secondsPerMinute * msPerSecond;

    expectFullGrid("Australia/Lord_Howe", before);
    expectFullGrid("Australia/Lord_Howe", after);
    expect(firstSlot(before).toISOString()).toBe("2026-10-02T22:30:00.000Z");
    expect(firstSlot(after).toISOString()).toBe("2026-10-03T22:00:00.000Z");
    expect(firstSlot(after).getTime() - firstSlot(before).getTime()).toBe(gapMs);
  });
});
