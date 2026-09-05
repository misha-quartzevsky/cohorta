/**
 * ============================================
 *  tests/account-hygiene.spec.ts — P4
 * ============================================
 *
 * Минимальная гигиена аккаунта:
 *  - /privacy открывается (в т.ч. без авторизации), ссылка в
 *    подвале /login туда ведёт;
 *  - из профиля можно запросить удаление аккаунта → строка
 *    deletion_requests, разлогин, уведомление на /login;
 *  - повторный вход показывает «Запрос отправлен».
 */

import { test, expect, type Page } from "@playwright/test";
import { LAST_SEMESTER_KEY } from "./helpers";

const PASSWORD = "test12345";

async function registerFresh(page: Page): Promise<string> {
  const email = `hyg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "1" }
  );
  await page.goto("/login");
  await page.locator(".login-switch").dispatchEvent("click");
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(PASSWORD);
  await pw.nth(1).fill(PASSWORD);
  await pw.nth(1).press("Enter");
  await page.waitForURL(/\/s\//);
  return email;
}

test("страница политики данных доступна и без входа + ссылка из /login", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page.locator(".privacy-title")).toHaveText("Политика данных");

  await page.goto("/login");
  await page.locator(".login-footer-link", { hasText: "Политика данных" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator(".privacy-title")).toBeVisible();
});

test("запрос на удаление аккаунта: подтверждение → разлогин → уведомление", async ({
  page,
}) => {
  const email = await registerFresh(page);

  // из профиля сайдбара
  await page
    .locator(".sidebar-account-link", { hasText: "Удалить аккаунт и данные" })
    .click();
  await expect(page.locator(".confirm-title")).toHaveText(
    "Удалить аккаунт и данные"
  );
  await page.locator(".btn-primary", { hasText: "Отправить запрос" }).click();

  // разлогинен, на /login — уведомление
  await page.waitForURL(/\/login\?deletion=1/);
  await expect(page.locator(".login-notice")).toContainText(
    "Запрос на удаление аккаунта принят"
  );

  // повторный вход → в профиле «Запрос отправлен»
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.fill(PASSWORD);
  await pw.press("Enter");
  await page.waitForURL(/\/s\//);
  await expect(
    page.locator(".sidebar-account-note", { hasText: "Запрос на удаление отправлен" })
  ).toBeVisible({ timeout: 8000 });
});
