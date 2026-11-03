import { type Browser, type Page, expect, test } from "@playwright/test";

import { openHalfHourType } from "./event-type.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- a Слот is 30 minutes
const slotLengthMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;
// oxlint-disable-next-line eslint/no-magic-numbers -- the default Лимит бронирований is 2, so the third Слот is the one that fails
const slotsOnOneDay = 3;

const guestTimeZone = "America/New_York";
const ownerTimeZone = "Europe/Moscow";
const guestEmail = "boris@example.com";
const slotMs = slotLengthMinutes * secondsPerMinute * msPerSecond;
const limitReached = "На этот день уже достигнут лимит бронирований";

test.use({ timezoneId: guestTimeZone });

interface ListedSlot {
  startAt: string;
  status: string;
}

interface DaySlots {
  first: Date;
  second: Date;
  third: Date;
}

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

const ownerDayKey = (instant: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: ownerTimeZone,
    year: "numeric",
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isListedSlot = (value: unknown): value is ListedSlot =>
  isRecord(value) && typeof value["startAt"] === "string" && typeof value["status"] === "string";

const slotsFrom = (body: unknown): ListedSlot[] => {
  if (!isRecord(body) || !Array.isArray(body["slots"]) || !body["slots"].every(isListedSlot)) {
    throw new Error("slots response is not a list");
  }
  return body["slots"];
};

const freeStarts = (slots: ListedSlot[]): Date[] =>
  slots.flatMap((slot) => {
    if (slot.status !== "free") {
      return [];
    }
    return [new Date(slot.startAt)];
  });

const groupByOwnerDay = (starts: Date[]): Map<string, Date[]> => {
  const grouped = new Map<string, Date[]>();
  for (const start of starts) {
    const day = ownerDayKey(start);
    const group = grouped.get(day) ?? [];
    group.push(start);
    grouped.set(day, group);
  }
  return grouped;
};

const asTrio = (group: Date[] | undefined): DaySlots => {
  const [first, second, third] = group ?? [];
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error("No day has three free Слоты");
  }
  return { first, second, third };
};

const threeFreeOnOneDay = (slots: ListedSlot[]): DaySlots => {
  const grouped = groupByOwnerDay(freeStarts(slots));
  const full = [...grouped.values()].find((group) => group.length >= slotsOnOneDay);
  return asTrio(full);
};

const readTrio = async (page: Page, slug: string, eventTypeId: string): Promise<DaySlots> => {
  const listed = await page.request.get(`/api/calendars/${slug}/slots`, {
    params: {
      eventTypeId,
      from: "2020-01-01T00:00:00.000Z",
      to: "2040-01-01T00:00:00.000Z",
    },
  });
  expect(listed.ok()).toBeTruthy();
  const body: unknown = await listed.json();
  return threeFreeOnOneDay(slotsFrom(body));
};

const fillGuest = async (page: Page): Promise<void> => {
  await page.getByLabel("Имя").fill("Борис");
  await page.getByLabel("Email").fill(guestEmail);
};

const chooseSlot = async (page: Page, slug: string, start: Date): Promise<void> => {
  await page.goto(`/u/${slug}`);
  await page
    .getByRole("button", { name: new RegExp(`^${dayLabel(start)}, свободно`, "u") })
    .click();
  await page.getByRole("button", { name: rangeIn(start, guestTimeZone) }).click();
};

const bookAsGuest = async (page: Page, slug: string, start: Date): Promise<void> => {
  await chooseSlot(page, slug, start);
  await fillGuest(page);
  await page.getByRole("button", { name: "Забронировать" }).click();
  await expect(page.getByRole("heading", { name: "Вы записаны" })).toBeVisible();
};

const exhaustLimit = async (page: Page, slug: string, slots: DaySlots): Promise<void> => {
  await bookAsGuest(page, slug, slots.first);
  await bookAsGuest(page, slug, slots.second);
  await chooseSlot(page, slug, slots.third);
  await fillGuest(page);
  await page.getByRole("button", { name: "Забронировать" }).click();
};

const expectStillFree = async (page: Page, start: Date): Promise<void> => {
  await expect(page.getByRole("heading", { name: "Вы записаны" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: rangeIn(start, guestTimeZone) }).getByText("Свободно"),
  ).toBeVisible();
};

test("a guest sees the limit once one email has used it for the day", async ({
  browser,
  page,
}: {
  browser: Browser;
  page: Page;
}) => {
  const slug = `limit-${String(Date.now())}`;
  await registerOwner(page, `${slug}@example.com`, slug);
  const slots = await readTrio(page, slug, await openHalfHourType(page));
  const guest = await browser.newContext({ timezoneId: guestTimeZone });
  const guestPage = await guest.newPage();
  try {
    await exhaustLimit(guestPage, slug, slots);
    await expect(guestPage.getByText(limitReached)).toBeVisible();
    await expectStillFree(guestPage, slots.third);
  } finally {
    await guest.close();
  }
});
