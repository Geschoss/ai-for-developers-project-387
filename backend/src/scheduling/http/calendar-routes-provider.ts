import { BookSlot } from "../application/book-slot.js";
import { GetPublicCalendar } from "../application/get-public-calendar.js";
import { ListSlots } from "../application/list-slots.js";
import { CALENDAR_ROUTES, type CalendarRoutes } from "./calendar-routes.js";

const calendarRoutesProvider = {
  inject: [GetPublicCalendar, BookSlot, ListSlots],
  provide: CALENDAR_ROUTES,
  useFactory: (
    publicCalendar: GetPublicCalendar,
    bookSlot: BookSlot,
    listSlots: ListSlots,
  ): CalendarRoutes => ({
    bookSlot,
    listSlots,
    publicCalendar,
  }),
};

export { calendarRoutesProvider };
