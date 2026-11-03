import type { CalendarSlug } from "../../shared-kernel/calendar-slug.js";

/**
 * Who is looking at a Календарь. An anonymous Гость and an Администратор are absent:
 * neither owns a Календарь. The HTTP boundary resolves the session; the domain only sees this.
 */
interface Viewer {
  calendarSlug: CalendarSlug;
  id: string;
}

export type { Viewer };
