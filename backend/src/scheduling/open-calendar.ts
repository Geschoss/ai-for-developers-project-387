import type { Database } from "../platform/database/database.module.js";

/** The client Drizzle hands to a `transaction` callback. Registration and the Календарь share one. */
type CalendarTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface OpenCalendarCommand {
  ownerId: string;
  slug: string;
  timeZone: string;
}

/**
 * Port Планирования that opens a Календарь.
 * It lives beside the module, not under `domain/`: Идентификация calls it and must not import the domain (ADR-0008).
 */
interface OpenCalendar {
  openCalendar: (transaction: CalendarTransaction, command: OpenCalendarCommand) => Promise<void>;
}

/** Injection token. The Планирование module binds the Drizzle adapter and hands it to Идентификация. */
const OPEN_CALENDAR = Symbol("OPEN_CALENDAR");

export { OPEN_CALENDAR, type CalendarTransaction, type OpenCalendar, type OpenCalendarCommand };
