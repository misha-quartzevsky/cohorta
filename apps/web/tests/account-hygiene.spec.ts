/**
 * ============================================
 *  tests/account-hygiene.spec.ts — P4
 * ============================================
 *
 * Минимальная гигиена аккаунта:
 *  - /privacy открывается (в т.ч. без авторизации), ссылка в
 *    подвале /login туда ведёт;
 *  - из «Профиля и настроек» можно запросить удаление аккаунта → строка
 *    deletion_requests, разлогин;
 *  - повторный вход показывает «Аккаунт будет удалён …» с отменой.
 */

import { test, expect } from "@playwright/test";
import { registerFresh } from "./helpers";

const PASSWORD = "test12345";

test("страница политики данных доступна и без входа + ссылка из /login", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page.locator(".c-policy h1")).toHaveText("Политика данных");

  await page.goto("/login");
  await page.locator(".c-auth-legal a", { hasText: "политикой данных" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator(".c-policy h1")).toBeVisible();
});

test("запрос на удаление аккаунта: подтверждение → разлогин → экран «будет удалён»", async ({
  page,
}) => {
  const email = await registerFresh(page, "hyg");

  // из «Профиля и настроек»
  await page.locator(".c-shell-profile").dispatchEvent("click");
  await page.getByRole("button", { name: "Удалить аккаунт", exact: true }).click();
  const dialog = page.locator(".c-delete-dialog");
  await expect(dialog).toContainText("Удалить аккаунт?");
  await dialog.getByRole("button", { name: "Продолжить" }).click();
  await expect(dialog).toContainText("Подтверди удаление");
  await dialog.getByLabel("Подтверждение").fill("удалить");
  await dialog.getByRole("button", { name: "Удалить аккаунт", exact: true }).click();

  // разлогинен, на /login
  await page.waitForURL(/\/login\?deletion=1/);

  // повторный вход → экран «Аккаунт будет удалён …» с кнопкой отмены
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.fill(PASSWORD);
  await pw.press("Enter");
  await expect(page.locator(".c-delete-pending h1")).toContainText("Аккаунт будет удалён", { timeout: 8000 });
  await expect(page.getByRole("button", { name: "Отменить удаление" })).toBeVisible();
});
