const listedTimeZones = Intl.supportedValuesOf("timeZone");

/** `supportedValuesOf` omits `UTC`. A machine set to UTC, including CI, still needs it in the list. */
const withUtc = (names: readonly string[]): string[] => {
  if (names.includes("UTC")) {
    return [...names];
  }
  return ["UTC", ...names];
};

const timeZoneNames = withUtc(listedTimeZones);

/** The browser's IANA zone when the runtime knows it, otherwise UTC. */
const browserTimeZone = (): string => {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZoneNames.includes(zone)) {
    return zone;
  }
  return "UTC";
};

export { browserTimeZone, timeZoneNames };
