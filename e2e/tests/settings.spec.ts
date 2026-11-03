import { type Page, expect, test } from "@playwright/test";

const registerOwner = async (page: Page, email: string, slug: string): Promise<void> => {
  await page.goto("/register");
  await page.getByLabel("Имя").fill("Анна");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("long-enough");
  await page.getByLabel("Адрес календаря").fill(slug);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page.getByRole("heading", { name: "Предстоящие события" })).toBeVisible();
};

const chooseTimeZone = async (page: Page, name: string): Promise<void> => {
  const zone = page.getByRole("combobox", { name: "Часовой пояс" });
  await zone.click();
  await zone.fill(name);
  await page.getByRole("option", { exact: true, name }).click();
};

const expectDefaults = async (page: Page): Promise<void> => {
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Часовой пояс" })).toHaveValue("UTC");
  await expect(page.getByLabel("Горизонт планирования")).toHaveValue("14");
  await expect(page.getByLabel("Лимит бронирований")).toHaveValue("2");
};

const changeSettings = async (page: Page): Promise<void> => {
  await chooseTimeZone(page, "Europe/Moscow");
  await page.getByLabel("Горизонт планирования").fill("60");
  await page.getByLabel("Лимит бронирований").fill("18");
  await page.getByRole("button", { name: "Сохранить" }).click();
};

const expectSaved = async (page: Page): Promise<void> => {
  await expect(page.getByRole("combobox", { name: "Часовой пояс" })).toHaveValue("Europe/Moscow");
  await expect(page.getByLabel("Горизонт планирования")).toHaveValue("60");
  await expect(page.getByLabel("Лимит бронирований")).toHaveValue("18");
};

const createdTypeId = (body: unknown): string => {
  if (typeof body !== "object" || body === null || !("id" in body) || typeof body.id !== "string") {
    throw new TypeError("Тип события response has no id");
  }
  return body.id;
};

const fillType = async (page: Page): Promise<void> => {
  await page.getByLabel("Название").fill("Звонок");
  await page.getByLabel("Описание").fill("Короткий звонок");
  await page.getByLabel("Длительность, минуты").fill("30");
};

const addEventType = async (page: Page): Promise<void> => {
  await fillType(page);
  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/api/owner/event-types") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Добавить" }).click();
  const response = await created;
  const createdId = createdTypeId(await response.json());
  await expect(page.getByText("Звонок", { exact: true })).toBeVisible();
  await expect(page.getByText("Короткий звонок")).toBeVisible();
  await expect(page.getByText("30 минут")).toBeVisible();
  await expect(page.getByText(createdId)).toHaveCount(0);
};

test("owner registers, changes settings, and sees them after reload", async ({ page }) => {
  const suffix = String(Date.now());
  await registerOwner(page, `owner-${suffix}@example.com`, `owner-${suffix}`);
  await page.getByRole("link", { name: "Настройки" }).click();
  await expectDefaults(page);
  await changeSettings(page);
  await expect(page.getByText("Настройки сохранены")).toBeVisible();
  await page.reload();
  await expectSaved(page);
  await expect(page.getByText("Настройки сохранены")).toHaveCount(0);
  await addEventType(page);
});
