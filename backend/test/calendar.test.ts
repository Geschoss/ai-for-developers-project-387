import { describe, expect, it } from "vitest";

import { Booking } from "../src/scheduling/domain/booking.js";
import { Calendar } from "../src/scheduling/domain/calendar.js";
import { DailyBookingLimit } from "../src/scheduling/domain/daily-booking-limit.js";
import { EventType } from "../src/scheduling/domain/event-type.js";
import { PlanningHorizon } from "../src/scheduling/domain/planning-horizon.js";
import { SchedulingError } from "../src/scheduling/domain/scheduling-error.js";
import type { Viewer } from "../src/scheduling/domain/viewer.js";
import { CalendarSlug } from "../src/shared-kernel/calendar-slug.js";
import { TimeZone } from "../src/shared-kernel/time-zone.js";

const ownerId = "owner-1";
const anna = CalendarSlug.parse("anna");
/**
 * 2026-11-03 01:00 in Pacific/Auckland (NZDT, UTC+13). 15:00 in Europe/Moscow.
 */
const aucklandMorning = new Date("2026-11-02T12:00:00.000Z");
/** 17:30 Europe/Moscow on 2026-11-02, still ahead of `aucklandMorning` and on the grid. */
const moscowAfternoon = "2026-11-02T14:30:00.000Z";
/** 16:00 Europe/Moscow on the same day. */
const moscowEarlier = "2026-11-02T13:00:00.000Z";
/** Midnight-to-midnight of 2026-11-02 in Europe/Moscow (UTC+3). */
const moscowDayFrom = new Date("2026-11-01T21:00:00.000Z");
const moscowDayTo = new Date("2026-11-02T21:00:00.000Z");
/** Midnight-to-midnight of 2026-11-03 in Pacific/Auckland (NZDT, UTC+13). */
const aucklandDayFrom = new Date("2026-11-02T11:00:00.000Z");
const aucklandDayTo = new Date("2026-11-03T11:00:00.000Z");
/** 17:30 on that Auckland day. */
const lastAucklandSlot = "2026-11-03T04:30:00.000Z";
/** 09:00 the next Auckland day. */
const nextAucklandSlot = "2026-11-03T20:00:00.000Z";
/** 09:00 Auckland on the previous civil day. */
const previousAucklandSlot = "2026-11-01T20:00:00.000Z";
/** 09:15 Europe/Moscow: between two Слоты. */
const offGrid = "2026-11-02T06:15:00.000Z";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Календарь starts with a horizon of 14
const defaultHorizon = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Календарь starts with a limit of 2
const defaultLimit = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- today only
const oneDayHorizon = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid these tests book is 30 minutes
const halfHourMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;
// oxlint-disable-next-line unicorn/no-null -- a Бронирование without a Заметка carries null
const absentNote = null;

const defaultTypeId = "type-30";
const halfHour = EventType.restore({
  description: "Короткий звонок",
  durationMinutes: halfHourMinutes,
  id: defaultTypeId,
  name: "Звонок",
});

const endsAt = (startAt: string): Date =>
  new Date(Date.parse(startAt) + halfHourMinutes * secondsPerMinute * msPerSecond);

const otherViewer: Viewer = {
  calendarSlug: CalendarSlug.parse("boris"),
  id: "owner-2",
};

const ownViewer: Viewer = { calendarSlug: anna, id: ownerId };

interface Restored {
  bookings?: readonly Booking[];
  dayFrom: Date;
  dayTo: Date;
  eventTypes?: readonly EventType[];
  horizon?: number;
  limit?: number;
  timeZone: string;
}

const restore = (input: Restored): Calendar =>
  Calendar.restore({
    bookings: input.bookings ?? [],
    dailyBookingLimit: DailyBookingLimit.parse(input.limit ?? defaultLimit),
    dayFrom: input.dayFrom,
    dayTo: input.dayTo,
    eventTypes: input.eventTypes ?? [halfHour],
    id: "calendar-1",
    ownerId,
    ownerName: "Анна",
    planningHorizon: PlanningHorizon.parse(input.horizon ?? defaultHorizon),
    slug: anna,
    timeZone: TimeZone.parse(input.timeZone),
  });

const moscowCalendar = (
  input: {
    bookings?: readonly Booking[];
    eventTypes?: readonly EventType[];
    limit?: number;
  } = {},
): Calendar =>
  restore({
    dayFrom: moscowDayFrom,
    dayTo: moscowDayTo,
    timeZone: "Europe/Moscow",
    ...input,
  });

interface BookAttempt {
  calendar: Calendar;
  email?: string;
  eventTypeId?: string;
  now?: Date;
  startAt: string;
  viewer?: Viewer;
}

const book = (attempt: BookAttempt): string | undefined => {
  const email = attempt.email ?? "boris@example.com";
  const now = attempt.now ?? aucklandMorning;
  try {
    attempt.calendar.book({
      eventTypeId: attempt.eventTypeId ?? defaultTypeId,
      guestEmail: email,
      guestName: "Борис",
      note: absentNote,
      now,
      startAt: new Date(attempt.startAt),
      viewer: attempt.viewer,
    });
    return undefined;
  } catch (error) {
    if (error instanceof SchedulingError) {
      return error.code;
    }
    throw error;
  }
};

const storedBooking = (startAt: string, id: string, email = "vera@example.com"): Booking =>
  new Booking({
    endAt: endsAt(startAt),
    eventTypeId: defaultTypeId,
    guestEmail: email,
    guestName: "Вера",
    id,
    note: absentNote,
    startAt: new Date(startAt),
  });

describe("booking a free Слот", () => {
  it("books a free Слот for a visitor who does not own it", () => {
    const calendar = moscowCalendar();

    expect(book({ calendar, startAt: moscowAfternoon })).toBeUndefined();
    expect(calendar.addedBookings().map((booking) => booking.startAt.toISOString())).toEqual([
      moscowAfternoon,
    ]);
  });

  it("rejects the Владелец's own Календарь and lets another Владелец book it", () => {
    const own = moscowCalendar();
    const foreign = moscowCalendar();

    expect(book({ calendar: own, startAt: moscowAfternoon, viewer: ownViewer })).toBe(
      "own_calendar",
    );
    expect(
      book({ calendar: foreign, startAt: moscowAfternoon, viewer: otherViewer }),
    ).toBeUndefined();
  });

  it("rejects an instant that is not a start on the grid", () => {
    const calendar = moscowCalendar();

    expect(book({ calendar, startAt: offGrid })).toBe("not_a_slot_start");
  });
});

describe("the past and the Горизонт планирования", () => {
  it("rejects a Слот that has already started, including one that starts at now", () => {
    const calendar = restore({
      dayFrom: aucklandDayFrom,
      dayTo: aucklandDayTo,
      timeZone: "Pacific/Auckland",
    });
    const started = book({
      calendar,
      email: "boris@example.com",
      now: new Date(lastAucklandSlot),
      startAt: lastAucklandSlot,
    });

    expect(started).toBe("slot_in_past");
    expect(book({ calendar, startAt: previousAucklandSlot })).toBe("slot_in_past");
  });

  it("accepts the last day of the Горизонт планирования and rejects the next", () => {
    const lastDay = restore({
      dayFrom: aucklandDayFrom,
      dayTo: aucklandDayTo,
      horizon: oneDayHorizon,
      timeZone: "Pacific/Auckland",
    });
    const nextDay = restore({
      dayFrom: new Date("2026-11-03T11:00:00.000Z"),
      dayTo: new Date("2026-11-04T11:00:00.000Z"),
      horizon: oneDayHorizon,
      timeZone: "Pacific/Auckland",
    });

    expect(book({ calendar: lastDay, startAt: lastAucklandSlot })).toBeUndefined();
    expect(book({ calendar: nextDay, startAt: nextAucklandSlot })).toBe("outside_planning_horizon");
  });
});

describe("one civil day", () => {
  it("counts one email once per civil day, ignoring register, and stops at the Лимит бронирований", () => {
    const existing = storedBooking(moscowEarlier, "booked-earlier", "Boris@Example.com");
    const calendar = moscowCalendar({ bookings: [existing], limit: 1 });
    const sameGuest = book({ calendar, email: "boris@example.com", startAt: moscowAfternoon });
    const otherGuest = book({ calendar, email: "vera@example.com", startAt: moscowAfternoon });

    expect(sameGuest).toBe("daily_limit_reached");
    expect(otherGuest).toBeUndefined();
  });

  it("rejects a Слот that this day already holds", () => {
    const existing = storedBooking(moscowAfternoon, "taken");
    const calendar = moscowCalendar({ bookings: [existing] });

    expect(book({ calendar, email: "boris@example.com", startAt: moscowAfternoon })).toBe(
      "slot_taken",
    );
    expect(calendar.addedBookings()).toEqual([]);
  });
});

describe("saving a new Бронирование", () => {
  it("appends only the new Бронирование and keeps the one already loaded for the day", () => {
    const existing = storedBooking(moscowEarlier, "kept");
    const calendar = moscowCalendar({ bookings: [existing] });
    const added = (): Booking => {
      const [booking] = calendar.addedBookings();
      if (booking === undefined) {
        throw new Error("Expected the new Бронирование");
      }
      return booking;
    };

    expect(book({ calendar, startAt: moscowAfternoon })).toBeUndefined();
    expect(added().id).not.toBe("kept");
    expect(added().guestEmail).toBe("boris@example.com");
    expect(book({ calendar, email: "vera@example.com", startAt: moscowEarlier })).toBe(
      "slot_taken",
    );
  });
});

describe("intervals of different Типы событий", () => {
  it("rejects an overlap and accepts the abutment", () => {
    // oxlint-disable-next-line eslint/no-magic-numbers -- an hour-long Тип события
    const hourMinutes = 60;
    const hour = EventType.restore({
      description: "Час",
      durationMinutes: hourMinutes,
      id: "type-60",
      name: "Час",
    });
    const calendar = moscowCalendar({ eventTypes: [hour, halfHour] });
    const now = new Date("2026-11-02T00:00:00.000Z");
    const ten = "2026-11-02T07:00:00.000Z";
    const tenThirty = "2026-11-02T07:30:00.000Z";
    const eleven = "2026-11-02T08:00:00.000Z";

    expect(book({ calendar, eventTypeId: hour.id, now, startAt: ten })).toBeUndefined();
    expect(book({ calendar, eventTypeId: halfHour.id, now, startAt: tenThirty })).toBe(
      "slot_taken",
    );
    expect(book({ calendar, eventTypeId: halfHour.id, now, startAt: eleven })).toBeUndefined();
  });
});
