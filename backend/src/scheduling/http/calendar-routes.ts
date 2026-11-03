import type { BookSlot } from "../application/book-slot.js";
import type { GetPublicCalendar } from "../application/get-public-calendar.js";
import type { ListSlots } from "../application/list-slots.js";

interface CalendarRoutes {
  bookSlot: BookSlot;
  listSlots: ListSlots;
  publicCalendar: GetPublicCalendar;
}

/** One token so the calendar controller stays within the constructor-parameter limit. */
const CALENDAR_ROUTES = Symbol("CALENDAR_ROUTES");

export { CALENDAR_ROUTES, type CalendarRoutes };
