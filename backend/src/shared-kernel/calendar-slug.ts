import { InvalidCalendarSlugError } from "./invalid-calendar-slug-error.js";

/** Адрес календаря: `[a-z0-9-]`, 3–30 characters, the same rule as the contract. */
const slugPattern = /^[a-z0-9-]+$/u;

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: an Адрес календаря is at least 3 characters
const minimumSlugLength = 3;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: an Адрес календаря is at most 30 characters
const maximumSlugLength = 30;

/** The public address of a Календарь. */
class CalendarSlug {
  private constructor(public readonly value: string) {}

  public static parse(value: string): CalendarSlug {
    if (
      value.length < minimumSlugLength ||
      value.length > maximumSlugLength ||
      !slugPattern.test(value)
    ) {
      throw new InvalidCalendarSlugError(value);
    }
    return new CalendarSlug(value);
  }

  public equals(other: CalendarSlug): boolean {
    return this.value === other.value;
  }
}

export { CalendarSlug };
