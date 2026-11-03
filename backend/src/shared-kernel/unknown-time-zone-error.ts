class UnknownTimeZoneError extends Error {
  public constructor(public readonly timeZone: string) {
    super(`Unknown time zone: ${timeZone}`);
    this.name = "UnknownTimeZoneError";
  }
}

export { UnknownTimeZoneError };
