import { expect, test } from "@playwright/test";

test("landing leads to registration and login", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Регистрация" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Войти" })).toBeVisible();
});
