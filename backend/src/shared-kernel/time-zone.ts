import { UnknownTimeZoneError } from "./unknown-time-zone-error.js";

const knownTimeZones = new Set(Intl.supportedValuesOf("timeZone"));

/** `supportedValuesOf` omits `UTC`, which `Intl` still accepts. GitHub Actions runs in that zone. */
const acceptsTimeZone = (timeZone: string): boolean => {
  try {
    const formatted = new Intl.DateTimeFormat("en", { timeZone }).format();
    return formatted.length > 0;
  } catch {
    return false;
  }
};

/** An IANA zone. An unknown name cannot be constructed. */
class TimeZone {
  private constructor(public readonly name: string) {}

  public static parse(timeZone: string): TimeZone {
    if (knownTimeZones.has(timeZone) || acceptsTimeZone(timeZone)) {
      return new TimeZone(timeZone);
    }
    throw new UnknownTimeZoneError(timeZone);
  }
}

export { TimeZone };
