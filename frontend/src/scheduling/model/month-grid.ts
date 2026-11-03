// oxlint-disable-next-line eslint/no-magic-numbers -- Monday-first week
const daysPerWeek = 7;
// oxlint-disable-next-line eslint/no-magic-numbers -- Sunday is 0; Monday is six days later
const daysFromSundayToMonday = 6;
// oxlint-disable-next-line eslint/no-magic-numbers -- zero-pad month and day
const padLength = 2;

const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface BlankCell {
  key: string;
  kind: "blank";
}

interface DayCell {
  day: number;
  key: string;
  kind: "day";
}

type MonthCell = BlankCell | DayCell;

interface YearMonth {
  month: number;
  year: number;
}

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const mondayOffset = (year: number, month: number): number => {
  const sundayBased = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (sundayBased + daysFromSundayToMonday) % daysPerWeek;
};

const dateKey = (year: number, month: number, day: number): string => {
  const shifted = new Date(Date.UTC(year, month - 1, day));
  const monthText = String(shifted.getUTCMonth() + 1).padStart(padLength, "0");
  const dayText = String(shifted.getUTCDate()).padStart(padLength, "0");
  return `${String(shifted.getUTCFullYear())}-${monthText}-${dayText}`;
};

const cellsOf = (year: number, month: number): MonthCell[] => {
  const cells: MonthCell[] = [];
  const offset = mondayOffset(year, month);
  for (let index = 0; index < offset; index += 1) {
    cells.push({ key: `blank-${String(index)}`, kind: "blank" });
  }
  const count = daysInMonth(year, month);
  for (let day = 1; day <= count; day += 1) {
    cells.push({ day, key: dateKey(year, month, day), kind: "day" });
  }
  return cells;
};

const monthTitle = (year: number, month: number): string =>
  new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

const shiftMonth = (year: number, month: number, direction: -1 | 1): YearMonth => {
  const shifted = new Date(Date.UTC(year, month - 1 + direction, 1));
  return { month: shifted.getUTCMonth() + 1, year: shifted.getUTCFullYear() };
};

const monthOfKey = (key: string): YearMonth => {
  const [yearText, monthText] = key.split("-");
  return { month: Number(monthText), year: Number(yearText) };
};

// oxlint-disable-next-line eslint/no-magic-numbers -- months in a year
const monthsPerYear = 12;

const monthIndex = (month: YearMonth): number => month.year * monthsPerYear + month.month;

/** The adjacent month is reachable only when it still holds a day of the horizon. */
const canShiftMonth = (month: YearMonth, bound: YearMonth, direction: -1 | 1): boolean => {
  if (direction === -1) {
    return monthIndex(month) > monthIndex(bound);
  }
  return monthIndex(month) < monthIndex(bound);
};

export { canShiftMonth, cellsOf, daysPerWeek, monthOfKey, monthTitle, shiftMonth, weekdayLabels };
export type { YearMonth };
