/**
 * ============================================
 *  tests/auth.spec.ts — вход в систему
 * ============================================
 *
 * 1. Неверные данные → ошибка «Не удалось войти…» на /login.
 * 2. Демо-доступы → редирект на /s/demo, в шапке — email пользователя.
 */

import { test, expect } from "@playwright/test";
import { DEMO_EMAIL, login } from "./helpers";

test("неверные данные: ошибка на странице /login", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("bad@example.com");
  const password = page.locator('input[type="password"]');
  await password.fill("wrong-password");
  // Enter вместо клика — см. комментарий в helpers.login (клик по «Войти»
  // завешивает headed-Firefox).
  await password.press("Enter");

  await expect(page.locator(".login-error")).toContainText(
    "Не удалось войти"
  );
});

test("демо-доступы: редирект на /s/demo и email в шапке", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await expect(page.locator(".hero-greeting")).toBeVisible();
  await expect(page.locator(".profile-email")).toHaveText(DEMO_EMAIL);
});
