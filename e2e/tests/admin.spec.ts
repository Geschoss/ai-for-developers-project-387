import { type Page, expect, test } from "@playwright/test";

import { admin } from "../playwright.config.ts";

const registerAndLogOut = async (page: Page, email: string, slug: string): Promise<void> => {
  await page.goto("/register");
  await page.getByLabel("Имя").fill("Борис");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("long-enough");
  await page.getByLabel("Адрес календаря").fill(slug);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page.getByRole("heading", { name: "Предстоящие события" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
};

const logInAsAdmin = async (page: Page): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Пароль").fill(admin.password);
  await page.getByRole("button", { name: "Войти" }).click();
};

test("admin sees a registered owner in the list", async ({ page }) => {
  const slug = `boris-${String(Date.now())}`;
  const email = `${slug}@example.com`;
  await registerAndLogOut(page, email, slug);

  await logInAsAdmin(page);

  await expect(page).toHaveURL(/\/admin\/users$/u);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Борис");
  await expect(row).toContainText(`/u/${slug}`);
  await expect(page.getByRole("link", { name: "Мой календарь" })).toHaveCount(0);
});
