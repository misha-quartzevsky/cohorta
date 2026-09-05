/**
 * ============================================
 *  tests/registration.spec.ts — самостоятельная регистрация
 * ============================================
 *
 * 1. Новый email → автологин → семестровый дашборд, email в профиле.
 * 2. Короткий пароль → ошибка «не короче 8».
 * 3. Несовпадение подтверждения → ошибка «не совпадают».
 * 4. Повторная регистрация того же email → ошибка «уже зарегистрирован».
 *
 * Тест плодит записи `users` в локальной БД (как editor.spec — маркеры).
 * Это ожидаемый dev-артефакт.
 */

import { test, expect, type Page } from "@playwright/test";
import { LAST_SEMESTER_KEY } from "./helpers";

const PASSWORD = "test12345";

/** Открывает /login и переключает форму в режим регистрации. */
async function openRegister(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "1" }
  );
  await page.goto("/login");
  // dispatchEvent — тот же приём, что для сайдбара: обходит click-флак headed-Firefox.
  await page.locator(".login-switch").dispatchEvent("click");
  await expect(page.locator(".login-title")).toHaveText("Регистрация в Cohorta");
}

async function fillForm(
  page: Page,
  email: string,
  password: string,
  confirm: string
): Promise<void> {
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(password);
  await pw.nth(1).fill(confirm);
}

test("новый email: автологин и попадание на дашборд", async ({ page }) => {
  const email = `reg-${Date.now()}@example.com`;
  await openRegister(page);
  await fillForm(page, email, PASSWORD, PASSWORD);
  await page.locator('input[type="password"]').nth(1).press("Enter");

  await page.waitForURL(/\/s\//);
  await expect(page.locator(".profile-email")).toHaveText(email);
});

test("стухшая чужая сессия не подменяет профиль после регистрации", async ({
  page,
}) => {
  // Эмулируем оставшийся в браузере токен другого аккаунта (жалоба
  // пользователя: регистрируюсь как X — открывается профиль Y).
  const ghost = JSON.stringify({
    token: "stale.jwt.token",
    record: {
      id: "ghost0000000000",
      collectionId: "_pb_users_auth_",
      collectionName: "users",
      email: "margart773@gmail.com",
      emailVisibility: true,
      verified: true,
    },
  });
  await page.addInitScript(
    ({ key, slug, ghostKey, ghostVal }) => {
      localStorage.setItem(key, slug);
      localStorage.setItem(ghostKey, ghostVal);
    },
    {
      key: LAST_SEMESTER_KEY,
      slug: "1",
      ghostKey: "pocketbase_auth",
      ghostVal: ghost,
    }
  );

  const email = `reg-ghost-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.locator(".login-switch").dispatchEvent("click");
  await fillForm(page, email, PASSWORD, PASSWORD);
  await page.locator('input[type="password"]').nth(1).press("Enter");

  await page.waitForURL(/\/s\//);
  await expect(page.locator(".profile-email")).toHaveText(email);
});

test("короткий пароль: ошибка", async ({ page }) => {
  await openRegister(page);
  await fillForm(page, `reg-short-${Date.now()}@example.com`, "short", "short");
  await page.locator('input[type="password"]').nth(1).press("Enter");

  await expect(page.locator(".login-error")).toContainText("не короче");
});

test("несовпадение подтверждения: ошибка", async ({ page }) => {
  await openRegister(page);
  await fillForm(
    page,
    `reg-mismatch-${Date.now()}@example.com`,
    PASSWORD,
    "test99999"
  );
  await page.locator('input[type="password"]').nth(1).press("Enter");

  await expect(page.locator(".login-error")).toContainText("не совпадают");
});

test("повторная регистрация того же email: ошибка", async ({ page }) => {
  const email = `reg-dup-${Date.now()}@example.com`;

  await openRegister(page);
  await fillForm(page, email, PASSWORD, PASSWORD);
  await page.locator('input[type="password"]').nth(1).press("Enter");
  await page.waitForURL(/\/s\//);

  // Выходим через профиль сайдбара и пробуем зарегистрировать тот же email.
  await page.locator(".profile-logout").dispatchEvent("click");
  await page.waitForURL("**/login");

  await page.locator(".login-switch").dispatchEvent("click");
  await fillForm(page, email, PASSWORD, PASSWORD);
  await page.locator('input[type="password"]').nth(1).press("Enter");

  await expect(page.locator(".login-error")).toContainText("уже зарегистрирован");
});
