import { problem } from "../platform/problem.js";
import { CalendarSlug } from "../shared-kernel/calendar-slug.js";
import { InvalidCalendarSlugError } from "../shared-kernel/invalid-calendar-slug-error.js";
import { TimeZone } from "../shared-kernel/time-zone.js";
import { UnknownTimeZoneError } from "../shared-kernel/unknown-time-zone-error.js";

interface FieldIssue {
  message: string;
  path: string;
}

/** A kernel parse failure is `validation_failed`, the same code as a body that breaks the schema. */
const rejectInvalid = (
  parse: () => void,
  isInvalid: (error: unknown) => boolean,
  issue: FieldIssue,
): void => {
  try {
    parse();
  } catch (error) {
    if (isInvalid(error)) {
      throw problem(400, "validation_failed", [issue]);
    }
    throw error;
  }
};

/** Unknown IANA zones are `validation_failed`. The zone list lives in `TimeZone`. */
const knownTimeZone = (timeZone: string): void => {
  rejectInvalid(
    () => {
      TimeZone.parse(timeZone);
    },
    (error) => error instanceof UnknownTimeZoneError,
    { message: "Unknown time zone", path: "/body/timeZone" },
  );
};

/** An Адрес календаря outside the shared rule is `validation_failed`. The rule lives in `CalendarSlug`. */
const knownCalendarSlug = (calendarSlug: string): void => {
  rejectInvalid(
    () => {
      CalendarSlug.parse(calendarSlug);
    },
    (error) => error instanceof InvalidCalendarSlugError,
    { message: "Invalid calendar slug", path: "/body/calendarSlug" },
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A unique index names which field of the registration is taken. Email wins over the Адрес календаря. */
const registrationConflict = (error: unknown): "email_taken" | "slug_taken" | undefined => {
  if (!isRecord(error) || !isRecord(error["cause"]) || error["cause"]["code"] !== "23505") {
    return undefined;
  }
  if (error["cause"]["constraint"] === "users_email_unique") {
    return "email_taken";
  }
  if (error["cause"]["constraint"] === "calendars_slug_unique") {
    return "slug_taken";
  }
  return undefined;
};

const rethrowConflict = (error: unknown): void => {
  const code = registrationConflict(error);
  if (code !== undefined) {
    throw problem(409, code);
  }
  throw error;
};

export { knownCalendarSlug, knownTimeZone, registrationConflict, rethrowConflict };
