import { dayKey, type DayGroup } from "./slot-time";

interface HorizonQuery {
  guestTimeZone: string;
  now: Date;
  ownerTimeZone: string;
  planningHorizonDays: number;
}

interface CivilDate {
  day: number;
  month: number;
  year: number;
}

interface LocalMinute extends CivilDate {
  hour: number;
  minute: number;
  timeZone: string;
}

// oxlint-disable-next-line eslint/no-magic-numbers -- noon exists on every civil day, including a DST gap
const middayHour = 12;

const formatterFor = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });

const readPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
  const found = parts.find((part) => part.type === type);
  if (found === undefined) {
    throw new Error(`Missing date part ${type}`);
  }
  return Number(found.value);
};

const offsetMs = (formatter: Intl.DateTimeFormat, instant: Date): number => {
  const parts = formatter.formatToParts(instant);
  const wall = Date.UTC(
    readPart(parts, "year"),
    readPart(parts, "month") - 1,
    readPart(parts, "day"),
    readPart(parts, "hour"),
    readPart(parts, "minute"),
    readPart(parts, "second"),
  );
  return wall - instant.getTime();
};

const localToUtc = (local: LocalMinute): Date => {
  const formatter = formatterFor(local.timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
  const adjusted = asUtc - offsetMs(formatter, new Date(asUtc));
  return new Date(asUtc - offsetMs(formatter, new Date(adjusted)));
};

const ownerToday = (now: Date, timeZone: string): CivilDate => {
  const parts = formatterFor(timeZone).formatToParts(now);
  return {
    day: readPart(parts, "day"),
    month: readPart(parts, "month"),
    year: readPart(parts, "year"),
  };
};

const addDays = (date: CivilDate, days: number): CivilDate => {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
};

/** Guest-local days of the Горизонт планирования, today in the Владелец's zone included. */
const horizonGuestKeys = (query: HorizonQuery): string[] => {
  const today = ownerToday(query.now, query.ownerTimeZone);
  const keys: string[] = [];
  for (let offset = 0; offset < query.planningHorizonDays; offset += 1) {
    const date = addDays(today, offset);
    const noon = localToUtc({
      ...date,
      hour: middayHour,
      minute: 0,
      timeZone: query.ownerTimeZone,
    });
    keys.push(dayKey(noon.toISOString(), query.guestTimeZone));
  }
  return keys;
};

/** A horizon day with no remaining Слоты still shows a free-count of zero. */
const withHorizonDays = (
  groups: Map<string, DayGroup>,
  keys: readonly string[],
): Map<string, DayGroup> => {
  const filled = new Map(groups);
  for (const key of keys) {
    if (!filled.has(key)) {
      filled.set(key, { free: 0, slots: [] });
    }
  }
  return filled;
};

export { horizonGuestKeys, withHorizonDays };
