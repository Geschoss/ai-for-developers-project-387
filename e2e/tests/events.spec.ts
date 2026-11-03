import { type Browser, type Page, expect, test } from "@playwright/test";

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

/** `2026-03-28-09:00` in `timeZone`, the same shape the events page prints. */
const stamp = (instant: Date, timeZone: string): string => {
  const date = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(instant);
  return `${date}-${clock(instant, timeZone)}`;
};

const dayLabel = (instant: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: guestTimeZone,
  }).format(instant);

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

const submitGuest = async (page: Page, slug: string, start: Date): Promise<void> => {
  await page.goto(`/u/${slug}`);
  await page
    .getByRole("button", { name: new RegExp(`^${dayLabel(start)}, свободно`, "u") })
    .click();
  await page.getByRole("button", { name: rangeIn(start, guestTimeZone) }).click();
  await page.getByLabel("Имя").fill("Борис");
  await page.getByLabel("Email").fill("boris@example.com");
  await page.getByRole("button", { name: "Забронировать" }).click();
  await expect(page.getByRole("heading", { name: "Вы записаны" })).toBeVisible();
};

const bookAsGuest = async (browser: Browser, slug: string, start: Date): Promise<void> => {
  const guest = await browser.newContext({ timezoneId: guestTimeZone });
  const page = await guest.newPage();
  try {
    await submitGuest(page, slug, start);
  } finally {
    await guest.close();
  }
};

const expectListed = async (page: Page, start: Date): Promise<void> => {
  await expect(page.getByText("Борис", { exact: true })).toBeVisible();
  await expect(page.getByText("boris@example.com")).toBeVisible();
  await expect(page.getByText("Звонок", { exact: true })).toBeVisible();
  await expect(page.getByText(`Слот: ${stamp(start, ownerTimeZone)}`)).toBeVisible();
  await expect(page.getByText(`Слот: ${stamp(start, guestTimeZone)}`)).toHaveCount(0);
  await expect(page.getByText(/^Создано:/u)).toBeVisible();
  await expect(page.getByText("Предстоящих событий нет")).toHaveCount(0);
};

test("a Гость's Бронирование appears in the Владелец's upcoming events", async ({
  browser,
  page,
}) => {
  const suffix = String(Date.now());
  const slug = `events-${suffix}`;
  await registerOwner(page, `${slug}@example.com`, slug);
  await expect(page.getByText("Предстоящих событий нет")).toBeVisible();
  const eventTypeId = await openHalfHourType(page);
  const start = await readFirstStart(page, slug, eventTypeId);
  await bookAsGuest(browser, slug, start);

  await page.reload();
  await expectListed(page, start);
});
