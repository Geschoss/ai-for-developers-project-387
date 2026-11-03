import { assert, constantFrom, integer, property } from "fast-check";
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
// oxlint-disable-next-line eslint/no-magic-numbers -- hours in a day
const hoursPerDay = 24;
// oxlint-disable-next-line eslint/no-magic-numbers -- 04:00 local is before the grid and after a typical DST jump
const earlyHour = 4;
// oxlint-disable-next-line eslint/no-magic-numbers -- widest civil UTC offset, in hours
const maxOffsetHours = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- days sampled from the sample year
const sampledDays = 800;
// oxlint-disable-next-line eslint/no-magic-numbers -- Горизонт планирования is at most 60
const maxHorizon = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- pad the UTC window past the last local day
const horizonPaddingDays = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- the year the properties sample
const sampleYear = 2026;
// oxlint-disable-next-line eslint/no-magic-numbers -- a busy CI runner can spend past 20s on the zone scan
const propertyTimeoutMs = 60_000;

const hourMs = minutesPerHour * secondsPerMinute * msPerSecond;
const msPerDay = hoursPerDay * hourMs;
const wideFrom = new Date("2020-01-01T00:00:00.000Z");
const wideTo = new Date("2040-01-01T00:00:00.000Z");

const zones = [
  "UTC",
  "Europe/Moscow",
  "Europe/Berlin",
  "America/New_York",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Asia/Kolkata",
  "Pacific/Chatham",
] as const;

interface LocalParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}

interface CivilTime {
  day: number;
  hour: number;
  minute: number;
  month: number;
  timeZone: string;
  year: number;
}

interface WindowCheck {
  from: Date;
  horizon: number;
  now: Date;
  timeZone: string;
  to: Date;
}

interface DayBounds {
  allowed: Set<number>;
  lastIndex: number;
  todayIndex: number;
}

const gridMinutes = (): number[] => {
  const minutes: number[] = [];
  for (let index = 0; index < slotsPerDay; index += 1) {
    minutes.push(firstSlotHour * minutesPerHour + index * slotLengthMinutes);
  }
  return minutes;
};

const readPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
  const found = parts.find((part) => part.type === type);
  if (found === undefined) {
    throw new Error(`Missing ${type}`);
  }
  return Number(found.value);
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
  return {
    day: readPart(parts, "day"),
    hour: readPart(parts, "hour"),
    minute: readPart(parts, "minute"),
    month: readPart(parts, "month"),
    year: readPart(parts, "year"),
  };
};

const localMinutes = (timeZone: string, instant: Date): number => {
  const parts = localParts(timeZone, instant);
  return parts.hour * minutesPerHour + parts.minute;
};

const sameClock = (parts: LocalParts, target: CivilTime): boolean =>
  parts.year === target.year &&
  parts.month === target.month &&
  parts.day === target.day &&
  parts.hour === target.hour &&
  parts.minute === target.minute;

/** Wall-clock instant found by scanning Intl, not by the code under test. */
const instantAt = (target: CivilTime): Date => {
  const start = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour - maxOffsetHours,
    target.minute,
  );
  const end = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour + maxOffsetHours,
    target.minute,
  );
  for (let time = start; time <= end; time += secondsPerMinute * msPerSecond) {
    const instant = new Date(time);
    if (sameClock(localParts(target.timeZone, instant), target)) {
      return instant;
    }
  }
  throw new Error(`No instant for ${target.timeZone}`);
};

const expectFullDay = (timeZone: string, dayOffset: number): void => {
  const shifted = new Date(Date.UTC(sampleYear, 0, 1 + dayOffset));
  const now = instantAt({
    day: shifted.getUTCDate(),
    hour: earlyHour,
    minute: 0,
    month: shifted.getUTCMonth() + 1,
    timeZone,
    year: shifted.getUTCFullYear(),
  });
  const slots = bookableSlots({
    durationMinutes: slotLengthMinutes,
    from: wideFrom,
    now,
    planningHorizonDays: 1,
    timeZone,
    to: wideTo,
  });
  expect(slots.map((slot) => localMinutes(timeZone, slot))).toEqual(gridMinutes());
  expect(slots.every((slot) => slot.getTime() > now.getTime())).toBe(true);
};

const boundsOf = (check: WindowCheck): DayBounds => {
  const today = localParts(check.timeZone, check.now);
  const todayIndex = Date.UTC(today.year, today.month - 1, today.day);
  const last = new Date(Date.UTC(today.year, today.month - 1, today.day + check.horizon - 1));
  return {
    allowed: new Set(gridMinutes()),
    lastIndex: Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()),
    todayIndex,
  };
};

interface PlacedSlot {
  bounds: DayBounds;
  check: WindowCheck;
  previous: number;
}

const expectOne = (slot: Date, placed: PlacedSlot): void => {
  const local = localParts(placed.check.timeZone, slot);
  const index = Date.UTC(local.year, local.month - 1, local.day);
  expect(placed.bounds.allowed.has(local.hour * minutesPerHour + local.minute)).toBe(true);
  expect(index).toBeGreaterThanOrEqual(placed.bounds.todayIndex);
  expect(index).toBeLessThanOrEqual(placed.bounds.lastIndex);
  expect(slot.getTime()).toBeGreaterThan(placed.check.now.getTime());
  expect(slot.getTime()).toBeGreaterThanOrEqual(placed.check.from.getTime());
  expect(slot.getTime()).toBeLessThan(placed.check.to.getTime());
  expect(slot.getTime()).toBeGreaterThan(placed.previous);
};

const addDay = (perDay: Map<number, number>, timeZone: string, slot: Date): void => {
  const local = localParts(timeZone, slot);
  const index = Date.UTC(local.year, local.month - 1, local.day);
  perDay.set(index, (perDay.get(index) ?? 0) + 1);
};

const expectCounts = (perDay: Map<number, number>): void => {
  for (const count of perDay.values()) {
    expect(count).toBeLessThanOrEqual(slotsPerDay);
  }
};

const expectWithinRules = (slots: Date[], check: WindowCheck): void => {
  const bounds = boundsOf(check);
  const perDay = new Map<number, number>();
  let previous = Number.NEGATIVE_INFINITY;
  for (const slot of slots) {
    expectOne(slot, { bounds, check, previous });
    previous = slot.getTime();
    addDay(perDay, check.timeZone, slot);
  }
  expectCounts(perDay);
};

const checkWindow = (timeZone: string, dayOffset: number, horizon: number): void => {
  const now = new Date(Date.UTC(sampleYear, 0, 1) + dayOffset * msPerDay);
  const from = new Date(now.getTime() - msPerDay);
  const to = new Date(now.getTime() + (horizon + horizonPaddingDays) * msPerDay);
  expectWithinRules(
    bookableSlots({
      durationMinutes: slotLengthMinutes,
      from,
      now,
      planningHorizonDays: horizon,
      timeZone,
      to,
    }),
    {
      from,
      horizon,
      now,
      timeZone,
      to,
    },
  );
};

describe("bookableSlots properties", () => {
  it(
    "returns 18 Слоты on a day that has not started, in any of the sampled zones",
    () => {
      assert(
        property(
          constantFrom(...zones),
          integer({ max: sampledDays, min: 0 }),
          (timeZone, dayOffset) => {
            expectFullDay(timeZone, dayOffset);
          },
        ),
      );
    },
    propertyTimeoutMs,
  );

  it(
    "keeps every Слот on the grid, inside the horizon, and strictly in the future",
    () => {
      assert(
        property(
          constantFrom(...zones),
          integer({ max: sampledDays, min: 0 }),
          integer({ max: maxHorizon, min: 1 }),
          (timeZone, dayOffset, horizon) => {
            checkWindow(timeZone, dayOffset, horizon);
          },
        ),
      );
    },
    propertyTimeoutMs,
  );
});
