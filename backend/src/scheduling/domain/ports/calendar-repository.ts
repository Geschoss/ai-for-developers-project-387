import type { CalendarSlug } from "../../../shared-kernel/calendar-slug.js";
import type { Calendar } from "../calendar.js";

/**
 * Loads a Календарь already under the caller's lock and appends the day's new Бронирования.
 * Must run inside a {@link UnitOfWork}. Other days are not loaded and are not written.
 */
interface CalendarRepository {
  loadLocked: (slug: CalendarSlug, startAt: Date) => Promise<Calendar | undefined>;
  save: (calendar: Calendar) => Promise<void>;
}

/** Injection token. The module binds the Drizzle adapter. */
const CALENDAR_REPOSITORY = Symbol("CALENDAR_REPOSITORY");

export { CALENDAR_REPOSITORY, type CalendarRepository };
