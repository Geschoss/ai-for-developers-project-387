import { randomUUID } from "node:crypto";

import { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import { TimeZone } from "../../shared-kernel/time-zone.js";
import { Booking, type StoredBooking, intervalsOverlap } from "./booking.js";
import { DailyBookingLimit } from "./daily-booking-limit.js";
import { EventType, type StoredEventType } from "./event-type.js";
import { PlanningHorizon } from "./planning-horizon.js";
import { SchedulingError } from "./scheduling-error.js";
import { SlotStart } from "./slot-start.js";
import type { Viewer } from "./viewer.js";

interface BookCommand {
  eventTypeId: string;
  guestEmail: string;
  guestName: string;
  note: string | null;
  now: Date;
  startAt: Date;
  /** Absent when the visitor does not own a Календарь. */
  viewer: Viewer | undefined;
}

interface CalendarSnapshot {
  bookings: readonly Booking[];
  dailyBookingLimit: DailyBookingLimit;
  /** Start of the one civil day whose Бронирования this Календарь holds. Inclusive. */
  dayFrom: Date;
  /** End of that civil day. Exclusive. */
  dayTo: Date;
  eventTypes: readonly EventType[];
  id: string;
  ownerId: string;
  ownerName: string;
  planningHorizon: PlanningHorizon;
  slug: CalendarSlug;
  timeZone: TimeZone;
}

interface LoadedCalendar {
  bookings: readonly StoredBooking[];
  dailyBookingLimit: number;
  dayFrom: Date;
  dayTo: Date;
  eventTypes: readonly StoredEventType[];
  id: string;
  ownerId: string;
  ownerName: string;
  planningHorizonDays: number;
  slug: string;
  timeZone: string;
}

const rejectPast = (start: SlotStart, now: Date): void => {
  if (start.instant.getTime() <= now.getTime()) {
    throw new SchedulingError("slot_in_past");
  }
};

/**
 * Consistency boundary of one Владелец: settings, plus the Бронирования of a single civil day.
 * `book` checks the invariants. The repository appends only {@link Calendar.addedBookings} and
 * leaves every other row alone.
 */
class Calendar {
  public readonly dailyBookingLimit: DailyBookingLimit;
  public readonly id: string;
  public readonly ownerId: string;
  public readonly ownerName: string;
  public readonly planningHorizon: PlanningHorizon;
  public readonly slug: CalendarSlug;
  public readonly timeZone: TimeZone;
  private readonly added: Booking[] = [];
  private readonly bookings: Booking[];
  private readonly dayFrom: Date;
  private readonly dayTo: Date;
  private readonly eventTypes: readonly EventType[];

  // oxlint-disable-next-line eslint/max-statements -- one assignment per snapshot field
  private constructor(snapshot: CalendarSnapshot) {
    this.id = snapshot.id;
    this.ownerId = snapshot.ownerId;
    this.ownerName = snapshot.ownerName;
    this.slug = snapshot.slug;
    this.timeZone = snapshot.timeZone;
    this.planningHorizon = snapshot.planningHorizon;
    this.dailyBookingLimit = snapshot.dailyBookingLimit;
    this.dayFrom = snapshot.dayFrom;
    this.dayTo = snapshot.dayTo;
    this.eventTypes = snapshot.eventTypes;
    this.bookings = [...snapshot.bookings];
  }

  /** A Календарь loaded for one civil day. Bookings already stored are not pending. */
  public static restore(snapshot: CalendarSnapshot): Calendar {
    return new Calendar(snapshot);
  }

  /** The repository passes plain columns. Value objects parse them here. */
  public static load(loaded: LoadedCalendar): Calendar {
    return new Calendar({
      bookings: loaded.bookings.map((booking) => new Booking(booking)),
      dailyBookingLimit: DailyBookingLimit.parse(loaded.dailyBookingLimit),
      dayFrom: loaded.dayFrom,
      dayTo: loaded.dayTo,
      eventTypes: loaded.eventTypes.map((eventType) => EventType.restore(eventType)),
      id: loaded.id,
      ownerId: loaded.ownerId,
      ownerName: loaded.ownerName,
      planningHorizon: PlanningHorizon.parse(loaded.planningHorizonDays),
      slug: CalendarSlug.parse(loaded.slug),
      timeZone: TimeZone.parse(loaded.timeZone),
    });
  }

  private acceptBooking(command: BookCommand, eventType: EventType, start: SlotStart): void {
    rejectPast(start, command.now);
    this.rejectHorizon(start, command.now);
    this.rejectOutsideLoadedDay(start);
    this.rejectLimit(command.guestEmail);
    this.appendBooking(command, eventType, start);
  }

  private appendBooking(command: BookCommand, eventType: EventType, start: SlotStart): void {
    const endAt = eventType.endsAt(start.instant);
    this.rejectOverlap(start.instant, endAt);
    const booking = new Booking({
      endAt,
      eventTypeId: eventType.id,
      guestEmail: command.guestEmail,
      guestName: command.guestName,
      id: randomUUID(),
      note: command.note,
      startAt: start.instant,
    });
    this.bookings.push(booking);
    this.added.push(booking);
  }

  /**
   * Own Календарь, then the Тип события, then the grid, then the past, then the Горизонт планирования.
   * The Лимит бронирований and a taken interval are decided from this day's Бронирования only.
   */
  public book(command: BookCommand): void {
    this.rejectOwnCalendar(command.viewer);
    const eventType = this.requireEventType(command.eventTypeId);
    const start = this.requireSlotStart(command.startAt, eventType.durationMinutes);
    this.acceptBooking(command, eventType, start);
  }

  /** Бронирования created by `book` since this Календарь was loaded. Save inserts these and nothing else. */
  public addedBookings(): readonly Booking[] {
    return [...this.added];
  }

  private rejectOwnCalendar(viewer: Viewer | undefined): void {
    if (viewer === undefined) {
      return;
    }
    if (viewer.id === this.ownerId || viewer.calendarSlug.equals(this.slug)) {
      throw new SchedulingError("own_calendar");
    }
  }

  private requireEventType(eventTypeId: string): EventType {
    const found = this.eventTypes.find((eventType) => eventType.id === eventTypeId);
    if (found === undefined) {
      throw new SchedulingError("event_type_not_found");
    }
    return found;
  }

  private requireSlotStart(startAt: Date, durationMinutes: number): SlotStart {
    const start = SlotStart.onGrid(startAt, this.timeZone, durationMinutes);
    if (start === undefined) {
      throw new SchedulingError("not_a_slot_start");
    }
    return start;
  }

  private rejectHorizon(start: SlotStart, now: Date): void {
    if (!this.planningHorizon.includes(start.instant, now, this.timeZone)) {
      throw new SchedulingError("outside_planning_horizon");
    }
  }

  /** The repository loads one day. A Слот on another day would be checked against the wrong Бронирования. */
  private rejectOutsideLoadedDay(start: SlotStart): void {
    const time = start.instant.getTime();
    if (time < this.dayFrom.getTime() || time >= this.dayTo.getTime()) {
      throw new Error("Слот is outside the civil day loaded into the Календарь");
    }
  }

  private rejectLimit(email: string): void {
    if (this.dailyBookingLimit.reached(this.countFor(email))) {
      throw new SchedulingError("daily_limit_reached");
    }
  }

  private countFor(email: string): number {
    const needle = email.toLowerCase();
    let count = 0;
    for (const booking of this.bookings) {
      if (booking.guestEmail.toLowerCase() === needle) {
        count += 1;
      }
    }
    return count;
  }

  private rejectOverlap(start: Date, end: Date): void {
    for (const booking of this.bookings) {
      if (intervalsOverlap({ end, start }, { end: booking.endAt, start: booking.startAt })) {
        throw new SchedulingError("slot_taken");
      }
    }
  }
}

export { Calendar };
