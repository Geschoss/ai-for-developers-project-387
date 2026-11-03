// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the smallest Лимит бронирований is 1
const minimumPerDay = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the largest Лимит бронирований is 18
const maximumPerDay = 18;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Календарь starts with a limit of 2
const openingPerDay = 2;

/** How many Бронирования one email may hold on one civil day of a Календарь. */
class DailyBookingLimit {
  private constructor(public readonly perDay: number) {}

  public static parse(perDay: number): DailyBookingLimit {
    if (!Number.isInteger(perDay) || perDay < minimumPerDay || perDay > maximumPerDay) {
      throw new Error(`Daily booking limit ${String(perDay)} is outside 1..18`);
    }
    return new DailyBookingLimit(perDay);
  }

  /** The Лимит бронирований registration gives a new Календарь. */
  public static opening(): DailyBookingLimit {
    return DailyBookingLimit.parse(openingPerDay);
  }

  public reached(count: number): boolean {
    return count >= this.perDay;
  }
}

export { DailyBookingLimit };
