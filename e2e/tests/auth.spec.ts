import { type Page, expect, test } from "@playwright/test";

const registerOwner = async (page: Page, email: string, slug: string): Promise<void> => {
  await page.goto("/register");
  await page.getByLabel("Имя").fill("Анна");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("long-enough");
  await page.getByLabel("Адрес календаря").fill(slug);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
};

const logIn = async (page: Page, email: string): Promise<void> => {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("long-enough");
  await page.getByRole("button", { name: "Войти" }).click();
};

test("owner registers, logs out, and logs in", async ({ page }) => {
  const suffix = String(Date.now());
  const email = `anna-${suffix}@example.com`;
  await registerOwner(page, email, `anna-${suffix}`);
  await expect(page.getByRole("heading", { name: "Предстоящие события" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Мой календарь" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Настройки" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
  await logIn(page, email);
  await expect(page.getByRole("heading", { name: "Предстоящие события" })).toBeVisible();
});
