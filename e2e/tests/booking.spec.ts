import { type Browser, type BrowserContext, type Page, expect, test } from "@playwright/test";

import { openHalfHourType } from "./event-type.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- a Слот is 30 minutes
const slotLengthMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;

const guestTimeZone = "America/New_York";
const ownerTimeZone = "Europe/Moscow";
const slotMs = slotLengthMinutes * secondsPerMinute * msPerSecond;

test.use({ timezoneId: guestTimeZone });

const clock = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).format(instant);

const rangeIn = (instant: Date, timeZone: string): string => {
  const end = new Date(instant.getTime() + slotMs);
  return `${clock(instant, timeZone)}–${clock(end, timeZone)}`;
};

const dayLabel = (instant: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: guestTimeZone,
  }).format(instant);

const freeCount = (label: string | null): number => {
  const matched = /свободно (?<count>\d+)/u.exec(label ?? "");
  if (matched === null || matched.groups === undefined) {
    throw new Error("The day button has no free count");
  }
  return Number(matched.groups["count"]);
};

const chooseTimeZone = async (page: Page, name: string): Promise<void> => {
  const zone = page.getByRole("combobox", { name: "Часовой пояс" });
  await zone.click();
  await zone.fill(name);
  await page.getByRole("option", { exact: true, name }).click();
};

const registerOwner = async (page: Page, email: string, slug: string): Promise<void> => {
  await page.goto("/register");
  await page.getByLabel("Имя").fill("Анна");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("long-enough");
  await page.getByLabel("Адрес календаря").fill(slug);
  await chooseTimeZone(page, ownerTimeZone);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page.getByRole("heading", { name: "Предстоящие события" })).toBeVisible();
};

interface ListedSlot {
  startAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isListedSlot = (value: unknown): value is ListedSlot =>
  isRecord(value) && typeof value["startAt"] === "string";

const slotsFrom = (body: unknown): ListedSlot[] => {
  if (!isRecord(body) || !Array.isArray(body["slots"]) || !body["slots"].every(isListedSlot)) {
    throw new Error("slots response is not a list");
  }
  return body["slots"];
};

const firstSlot = (slots: ListedSlot[]): ListedSlot => {
  const [slot] = slots;
  if (slot === undefined) {
    throw new Error("The calendar returned no Слоты");
  }
  return slot;
};

const readFirstStart = async (page: Page, slug: string, eventTypeId: string): Promise<Date> => {
  const listed = await page.request.get(`/api/calendars/${slug}/slots`, {
    params: {
      eventTypeId,
      from: "2020-01-01T00:00:00.000Z",
      to: "2040-01-01T00:00:00.000Z",
    },
  });
  expect(listed.ok()).toBeTruthy();
  const body: unknown = await listed.json();
  return new Date(firstSlot(slotsFrom(body)).startAt);
};

const noteLabel = "О чём хотите поговорить?";

const fillGuest = async (page: Page, name: string, email: string, note?: string): Promise<void> => {
  await page.getByLabel("Имя").fill(name);
  await page.getByLabel("Email").fill(email);
  if (note !== undefined) {
    await page.getByLabel(noteLabel).fill(note);
  }
};

const expectNote = async (page: Page, note: string): Promise<void> => {
  const shown = page.getByTestId("booking-note");
  await expect(shown).toBeVisible();
  await expect(shown).toHaveText(note);
  await expect(shown).toHaveCSS("white-space", "pre-wrap");
};

const chooseSlot = async (page: Page, slug: string, start: Date): Promise<void> => {
  await page.goto(`/u/${slug}`);
  await expect(page.getByRole("radio", { name: "Звонок" })).toBeChecked();
  await page
    .getByRole("button", { name: new RegExp(`^${dayLabel(start)}, свободно`, "u") })
    .click();
  await page.getByRole("button", { name: rangeIn(start, guestTimeZone) }).click();
};

const closeBoth = async (first: BrowserContext, second: BrowserContext): Promise<void> => {
  await first.close();
  await second.close();
};

const expectBooked = async (page: Page, start: Date): Promise<void> => {
  await expect(page.getByRole("heading", { name: "Вы записаны" })).toBeVisible();
  await expect(page.getByText("Анна", { exact: true })).toBeVisible();
  await expect(page.getByText(dayLabel(start), { exact: true })).toBeVisible();
  await expect(page.getByText(`Ваше время: ${rangeIn(start, guestTimeZone)}`)).toBeVisible();
  await expect(
    page.getByText(`Время владельца (${ownerTimeZone}): ${rangeIn(start, ownerTimeZone)}`),
  ).toBeVisible();
};

const expectConflict = async (page: Page, start: Date): Promise<void> => {
  const day = page.getByRole("button", {
    name: new RegExp(`^${dayLabel(start)}, свободно \\d+$`, "u"),
  });
  const before = freeCount(await day.getAttribute("aria-label"));
  await page.getByRole("button", { name: "Забронировать" }).click();
  await expect(page.getByText("Этот слот уже занят")).toBeVisible();
  await expect(page.getByText("Занято").first()).toBeVisible();
  await expect(day).toHaveAttribute(
    "aria-label",
    `${dayLabel(start)}, свободно ${String(before - 1)}`,
  );
};

interface Race {
  guestA: BrowserContext;
  guestB: BrowserContext;
  loser: Page;
  start: Date;
  winner: Page;
}

interface CalendarSlot {
  slug: string;
  start: Date;
}

const fillBoth = async (
  guestA: BrowserContext,
  guestB: BrowserContext,
  slot: CalendarSlot,
): Promise<{ loser: Page; winner: Page }> => {
  const winner = await guestA.newPage();
  const loser = await guestB.newPage();
  await chooseSlot(winner, slot.slug, slot.start);
  await chooseSlot(loser, slot.slug, slot.start);
  await fillGuest(winner, "Борис", "boris@example.com");
  await fillGuest(loser, "Вера", "vera@example.com");
  await winner.getByRole("button", { name: "Забронировать" }).click();
  return { loser, winner };
};

const openRace = async (browser: Browser, page: Page): Promise<Race> => {
  const suffix = String(Date.now());
  const slug = `book-${suffix}`;
  await registerOwner(page, `${slug}@example.com`, slug);
  const eventTypeId = await openHalfHourType(page);
  const start = await readFirstStart(page, slug, eventTypeId);
  const guestA = await browser.newContext({ timezoneId: guestTimeZone });
  const guestB = await browser.newContext({ timezoneId: guestTimeZone });
  const guests = await fillBoth(guestA, guestB, { slug, start });
  return { guestA, guestB, loser: guests.loser, start, winner: guests.winner };
};

test("two guests cannot book the same Слот", async ({ browser, page }) => {
  const race = await openRace(browser, page);
  try {
    await expect(race.winner.getByRole("heading", { name: "Вы записаны" })).toBeVisible();
    await expectBooked(race.winner, race.start);
    await expectConflict(race.loser, race.start);
  } finally {
    await closeBoth(race.guestA, race.guestB);
  }
});

test("a Заметка к Бронированию reaches the Владелец", async ({ browser, page }) => {
  const suffix = String(Date.now());
  const slug = `note-${suffix}`;
  const note = "Хочу обсудить проект.\nЕсть контекст.";
  await registerOwner(page, `${slug}@example.com`, slug);
  const eventTypeId = await openHalfHourType(page);
  const start = await readFirstStart(page, slug, eventTypeId);
  const guest = await browser.newContext({ timezoneId: guestTimeZone });
  const guestPage = await guest.newPage();
  try {
    await chooseSlot(guestPage, slug, start);
    await fillGuest(guestPage, "Борис", "boris@example.com", note);
    await guestPage.getByRole("button", { name: "Забронировать" }).click();
    await expect(guestPage.getByRole("heading", { name: "Вы записаны" })).toBeVisible();
    await expectNote(guestPage, note);
  } finally {
    await guest.close();
  }

  await page.reload();
  await expect(page.getByText("boris@example.com")).toBeVisible();
  await expectNote(page, note);
});

test("the losing Гость's Заметка is not stored", async ({ browser, page }) => {
  const suffix = String(Date.now());
  const slug = `note-race-${suffix}`;
  const winnerNote = "Заметка первого гостя.\nС переносом.";
  const loserNote = "Заметка второго гостя";
  await registerOwner(page, `${slug}@example.com`, slug);
  const eventTypeId = await openHalfHourType(page);
  const start = await readFirstStart(page, slug, eventTypeId);
  const guestA = await browser.newContext({ timezoneId: guestTimeZone });
  const guestB = await browser.newContext({ timezoneId: guestTimeZone });
  try {
    const winner = await guestA.newPage();
    const loser = await guestB.newPage();
    await chooseSlot(winner, slug, start);
    await chooseSlot(loser, slug, start);
    await fillGuest(winner, "Борис", "boris@example.com", winnerNote);
    await fillGuest(loser, "Вера", "vera@example.com", loserNote);
    await winner.getByRole("button", { name: "Забронировать" }).click();
    await expect(winner.getByRole("heading", { name: "Вы записаны" })).toBeVisible();
    await expectNote(winner, winnerNote);
    await expectConflict(loser, start);
    await expect(loser.getByLabel(noteLabel)).toHaveValue(loserNote);

    await page.reload();
    await expect(page.getByText("boris@example.com")).toBeVisible();
    await expectNote(page, winnerNote);
    await expect(page.getByText(loserNote)).toHaveCount(0);
  } finally {
    await closeBoth(guestA, guestB);
  }
});
