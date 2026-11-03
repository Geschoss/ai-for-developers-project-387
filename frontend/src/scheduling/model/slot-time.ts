import type { components } from "spec/api";

type Slot = components["schemas"]["Slot"];

// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;

interface DayGroup {
  free: number;
  slots: Slot[];
}

const clock = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).format(instant);

/** `09:00–09:30` in `timeZone`. The length is the chosen Тип события. */
const slotRange = (startAt: string, timeZone: string, durationMinutes: number): string => {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMinutes * secondsPerMinute * msPerSecond);
  return `${clock(start, timeZone)}–${clock(end, timeZone)}`;
};

/** Guest-local calendar day, `YYYY-MM-DD`. */
const dayKey = (startAt: string, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(new Date(startAt));

const civilNumbers = (key: string): { day: number; month: number; year: number } => {
  const [yearText, monthText, dayText] = key.split("-");
  return { day: Number(dayText), month: Number(monthText), year: Number(yearText) };
};

const dayLabel = (key: string): string => {
  const civil = civilNumbers(key);
  const instant = new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(instant);
};

interface ZoneBannerQuery {
  guestTimeZone: string;
  now: Date;
  ownerTimeZone: string;
  sampleStart: string | undefined;
}

const sampleInstant = (query: ZoneBannerQuery): Date => {
  if (query.sampleStart === undefined) {
    return query.now;
  }
  return new Date(query.sampleStart);
};

/**
 * Shown only when the Гость's zone and the Владелец's zone differ.
 * The time is the Владелец's wall clock for the same instant.
 */
const zoneBanner = (query: ZoneBannerQuery): string | undefined => {
  if (query.guestTimeZone === query.ownerTimeZone) {
    return undefined;
  }
  const ownerTime = clock(sampleInstant(query), query.ownerTimeZone);
  return `Ваш часовой пояс: ${query.guestTimeZone}. У владельца (${query.ownerTimeZone}): ${ownerTime}.`;
};

const freeIncrement = (status: Slot["status"]): number => {
  if (status === "free") {
    return 1;
  }
  return 0;
};

const groupByDay = (slots: readonly Slot[], timeZone: string): Map<string, DayGroup> => {
  const groups = new Map<string, DayGroup>();
  for (const slot of slots) {
    const key = dayKey(slot.startAt, timeZone);
    const existing = groups.get(key);
    const free = freeIncrement(slot.status);
    if (existing === undefined) {
      groups.set(key, { free, slots: [slot] });
    } else {
      existing.slots.push(slot);
      existing.free += free;
    }
  }
  return groups;
};

export { type DayGroup, dayKey, dayLabel, groupByDay, slotRange, zoneBanner };
