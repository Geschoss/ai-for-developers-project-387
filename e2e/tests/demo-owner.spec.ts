import { type Browser, type Page, expect, test } from "@playwright/test";

// oxlint-disable-next-line eslint/no-magic-numbers -- a Слот is 30 minutes
const slotLengthMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;

const guestTimeZone = "America/New_York";
const ownerTimeZone = "Europe/Moscow";
const slotMs = slotLengthMinutes * secondsPerMinute * msPerSecond;
const demoSlug = "demo";
const demoEmail = "demo@example.com";
const demoPassword = "demo-owner-1";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

interface ListedSlot {
  startAt: string;
  status: string;
}

const isListedSlot = (value: unknown): value is ListedSlot =>
  isRecord(value) && typeof value["startAt"] === "string" && typeof value["status"] === "string";

const slotsFrom = (body: unknown): ListedSlot[] => {
  if (!isRecord(body) || !Array.isArray(body["slots"]) || !body["slots"].every(isListedSlot)) {
    throw new Error("slots response is not a list");
  }
  return body["slots"];
};

const firstFree = (slots: ListedSlot[]): ListedSlot => {
  const slot = slots.find((item) => item.status === "free");
  if (slot === undefined) {
    throw new Error("The calendar returned no free Слот");
  }
  return slot;
};

interface EventTypeRow {
  id: string;
}

const isEventTypeRow = (value: unknown): value is EventTypeRow =>
  isRecord(value) && typeof value["id"] === "string";

const eventTypeIdOf = (body: unknown): string => {
  if (
    !isRecord(body) ||
    !Array.isArray(body["eventTypes"]) ||
    !body["eventTypes"].every(isEventTypeRow)
  ) {
    throw new Error("public calendar has no Типы событий");
  }
  const [first] = body["eventTypes"];
  if (first === undefined) {
    throw new Error("public calendar has no Типы событий");
  }
  return first.id;
};

const readEventTypeId = async (page: Page): Promise<string> => {
  const calendar = await page.request.get(`/api/calendars/${demoSlug}`);
  expect(calendar.ok()).toBeTruthy();
  const body: unknown = await calendar.json();
  return eventTypeIdOf(body);
};

const readFirstFree = async (page: Page, eventTypeId: string): Promise<Date> => {
  const listed = await page.request.get(`/api/calendars/${demoSlug}/slots`, {
    params: {
      eventTypeId,
      from: "2020-01-01T00:00:00.000Z",
      to: "2040-01-01T00:00:00.000Z",
    },
  });
  expect(listed.ok()).toBeTruthy();
  const body: unknown = await listed.json();
  return new Date(firstFree(slotsFrom(body)).startAt);
};

const submitGuest = async (page: Page, start: Date): Promise<void> => {
  await page.goto(`/u/${demoSlug}`);
  await page.getByRole("radio", { name: "Звонок" }).click();
  await page
    .getByRole("button", { name: new RegExp(`^${dayLabel(start)}, свободно`, "u") })
    .click();
  await page.getByRole("button", { name: rangeIn(start, guestTimeZone) }).click();
  await page.getByLabel("Имя").fill("Борис");
  await page.getByLabel("Email").fill("boris@example.com");
  await page.getByRole("button", { name: "Забронировать" }).click();
  await expect(page.getByRole("heading", { name: "Вы записаны" })).toBeVisible();
  await expect(page.getByText("Демо", { exact: true })).toBeVisible();
};

const bookAsGuest = async (browser: Browser, start: Date): Promise<void> => {
  const guest = await browser.newContext({ timezoneId: guestTimeZone });
  const page = await guest.newPage();
  try {
    await submitGuest(page, start);
  } finally {
    await guest.close();
  }
};

const logInDemo = async (page: Page): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(demoEmail);
  await page.getByLabel("Пароль").fill(demoPassword);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Предстоящие события" })).toBeVisible();
};

const expectListed = async (page: Page, start: Date): Promise<void> => {
  await expect(page.getByText("Борис", { exact: true })).toBeVisible();
  await expect(page.getByText("boris@example.com")).toBeVisible();
  await expect(page.getByText("Звонок", { exact: true })).toBeVisible();
  await expect(page.getByText(`Слот: ${stamp(start, ownerTimeZone)}`)).toBeVisible();
  await expect(page.getByText("Предстоящих событий нет")).toHaveCount(0);
};

test("a Гость books the demo Календарь and the demo Владелец sees it", async ({
  browser,
  page,
}) => {
  const start = await readFirstFree(page, await readEventTypeId(page));
  await bookAsGuest(browser, start);
  await logInDemo(page);
  await expect(page.getByRole("heading", { name: "Предстоящие события" })).toBeVisible();
  await expectListed(page, start);
});
