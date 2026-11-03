import type { CalendarSlug } from "../../../shared-kernel/calendar-slug.js";

/** What a Гость sees on the public page. No account fields, no other Гость. */
interface PublicEventType {
  description: string;
  durationMinutes: number;
  id: string;
  name: string;
}

interface PublicCalendarView {
  eventTypes: PublicEventType[];
  ownerName: string;
  planningHorizonDays: number;
  timeZone: string;
}

interface ListedSlot {
  startAt: string;
  status: "booked" | "free";
}

interface SlotListView {
  slots: ListedSlot[];
}

/** The three columns a Владелец edits. A change does not delete Бронирования. */
interface CalendarSettings {
  dailyBookingLimit: number;
  planningHorizonDays: number;
  timeZone: string;
}

/** Reads that do not assemble a Календарь and do not take the booking lock. */
interface PublicCalendarQuery {
  find: (slug: CalendarSlug) => Promise<PublicCalendarView | undefined>;
}

interface SlotListRequest {
  eventTypeId: string;
  from: Date;
  now: Date;
  slug: CalendarSlug;
  to: Date;
}

interface SlotListQuery {
  list: (request: SlotListRequest) => Promise<SlotListView | undefined>;
}

interface CalendarSettingsStore {
  get: (ownerId: string) => Promise<CalendarSettings>;
  save: (ownerId: string, settings: CalendarSettings) => Promise<CalendarSettings>;
}

const PUBLIC_CALENDAR_QUERY = Symbol("PUBLIC_CALENDAR_QUERY");
const SLOT_LIST_QUERY = Symbol("SLOT_LIST_QUERY");
const CALENDAR_SETTINGS_STORE = Symbol("CALENDAR_SETTINGS_STORE");

export {
  CALENDAR_SETTINGS_STORE,
  PUBLIC_CALENDAR_QUERY,
  SLOT_LIST_QUERY,
  type CalendarSettings,
  type CalendarSettingsStore,
  type PublicCalendarQuery,
  type PublicCalendarView,
  type PublicEventType,
  type SlotListQuery,
  type SlotListRequest,
  type SlotListView,
};
