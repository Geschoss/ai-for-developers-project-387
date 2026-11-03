import { Inject, Injectable } from "@nestjs/common";

import { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import {
  PUBLIC_CALENDAR_QUERY,
  type PublicCalendarQuery,
  type PublicCalendarView,
} from "../domain/ports/read-queries.js";
import { SchedulingError } from "../domain/scheduling-error.js";

/** Name, time zone and Горизонт планирования. No account fields. */
@Injectable()
class GetPublicCalendar {
  public constructor(
    @Inject(PUBLIC_CALENDAR_QUERY) private readonly calendars: PublicCalendarQuery,
  ) {}

  public async execute(calendarSlug: string): Promise<PublicCalendarView> {
    const calendar = await this.calendars.find(CalendarSlug.parse(calendarSlug));
    if (calendar === undefined) {
      throw new SchedulingError("calendar_not_found");
    }
    return calendar;
  }
}

export { GetPublicCalendar };
