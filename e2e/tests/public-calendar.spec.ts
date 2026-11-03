import { type Page, expect, test } from "@playwright/test";

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

const expectShiftedSlot = async (page: Page, start: Date): Promise<void> => {
  const end = new Date(start.getTime() + slotMs);
  const guestClock = clock(start, guestTimeZone);
  const ownerClock = clock(start, ownerTimeZone);
  const guestRange = `${guestClock}–${clock(end, guestTimeZone)}`;
  expect(guestClock).not.toBe(ownerClock);
  await expect(
    page.getByText(
      `Ваш часовой пояс: ${guestTimeZone}. У владельца (${ownerTimeZone}): ${ownerClock}.`,
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: new RegExp(`^${dayLabel(start)}, свободно`, "u") })
    .click();
  await expect(page.getByText(guestRange)).toBeVisible();
};

test("guest in another time zone sees the banner and a shifted Слот", async ({ page }) => {
  const suffix = String(Date.now());
  const slug = `guest-${suffix}`;
  await registerOwner(page, `${slug}@example.com`, slug);
  const eventTypeId = await openHalfHourType(page);
  await page.getByRole("link", { name: "Мой календарь" }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${slug}$`, "u"));
  await expect(page.getByRole("heading", { name: "Запись на звонок у Анна" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Звонок" })).toBeChecked();
  await expectShiftedSlot(page, await readFirstStart(page, slug, eventTypeId));
});

test("unknown Адрес календаря is not found", async ({ page }) => {
  await page.goto("/u/no-such-owner");
  await expect(page.getByRole("heading", { name: "Календарь не найден" })).toBeVisible();
});
