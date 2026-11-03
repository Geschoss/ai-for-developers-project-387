class InvalidCalendarSlugError extends Error {
  public constructor(public readonly value: string) {
    super(`Invalid calendar slug: ${value}`);
    this.name = "InvalidCalendarSlugError";
  }
}

export { InvalidCalendarSlugError };
