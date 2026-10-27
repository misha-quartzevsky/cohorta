/**
 * ============================================
 *  tests/registration.spec.ts — самостоятельная регистрация
 * ============================================
 *
 * 1. Новый email → автологин → онбординг → семестровый дашборд, email в профиле.
 * 2. Короткий пароль → ошибка «не короче 8».
 * 3. Несовпадение подтверждения → ошибка «не совпадают».
 * 4. Повторная регистрация того же email → ошибка «уже зарегистрирован».
 *
 * Тест плодит записи `users` в локальной БД (как editor.spec — маркеры).
 * Это ожидаемый dev-артефакт.
 */

import { test, expect } from "@playwright/test";
import {
  LAST_SEMESTER_KEY,
  completeOnboardingFast,
  expectAccountEmail,
  logout,
  openRegister,
  submitRegister,
} from "./helpers";

const PASSWORD = "test12345";

test("новый email: автологин и попадание на дашборд", async ({ page }) => {
  const email = `reg-${Date.now()}@example.com`;
  await openRegister(page);
  await submitRegister(page, email, PASSWORD, PASSWORD);

  await completeOnboardingFast(page);
  await expectAccountEmail(page, email);
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
  await page.locator(".c-auth-switch a").dispatchEvent("click");
  await submitRegister(page, email, PASSWORD, PASSWORD);

  await completeOnboardingFast(page);
  await expectAccountEmail(page, email);
});

test("короткий пароль: ошибка", async ({ page }) => {
  await openRegister(page);
  await submitRegister(page, `reg-short-${Date.now()}@example.com`, "short", "short");

  // Ошибка теперь стоит под полем пароля, а не одной строкой над формой.
  await expect(page.locator(".c-field.err")).toContainText("Минимум 8 символов");
});

test("несовпадение подтверждения: ошибка", async ({ page }) => {
  await openRegister(page);
  await submitRegister(
    page,
    `reg-mismatch-${Date.now()}@example.com`,
    PASSWORD,
    "test99999"
  );

  await expect(page.locator(".c-field.err")).toContainText("не совпадают");
});

test("повторная регистрация того же email: ошибка", async ({ page }) => {
  const email = `reg-dup-${Date.now()}@example.com`;

  await openRegister(page);
  await submitRegister(page, email, PASSWORD, PASSWORD);
  await completeOnboardingFast(page);

  // Выходим и пробуем зарегистрировать тот же email.
  await logout(page);

  await page.locator(".c-auth-switch a").dispatchEvent("click");
  await submitRegister(page, email, PASSWORD, PASSWORD);

  await expect(page.locator(".c-auth-error")).toContainText("уже зарегистрирован");
});
