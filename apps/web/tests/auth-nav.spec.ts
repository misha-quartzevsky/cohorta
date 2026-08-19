/**
 * ============================================
 *  tests/auth-nav.spec.ts — smoke: auth + navigation
 * ============================================
 *
 * Сценарий:
 *   1. Открываем /login, вводим демо-доступы из сид-миграции.
 *   2. Редирект на /s/demo (демо-семестр из seed).
 *   3. Дашборд → курс «Математический анализ» → лекция «Предел
 *      последовательности» (там живёт лекционный сайдбар).
 *   4. Сайдбар виден, его sticky-отступ сверху ровно 30px
 *      (getComputedStyle → box.top).
 */

import { test, expect } from "@playwright/test";
import { login, waitForStable } from "./helpers";

test("демо-логин: редирект на /s/demo и сайдбар с отступом 30px", async ({
  page,
}) => {
  await login(page, "demo");

  await page.waitForURL("**/s/demo");
  await expect(page.locator(".page-title")).toContainText("Семестр demo");

  // Дашборд → курс (секция «Курсы» — первый .dashboard-section).
  const courseTile = page
    .locator(".dashboard-section")
    .first()
    .locator(".tile-click", { hasText: "Математический анализ" });
  await waitForStable(page, courseTile);
  await courseTile.click();
  await page.waitForURL("**/s/demo/math-analysis");

  // Лекция → просмотр внутри LectureLayout.
  await page
    .locator(".tile-click", { hasText: "Предел последовательности" })
    .click();
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");

  // Сайдбар лекций: наличие + корректный отступ 30px от верха.
  const sidebar = page.locator(".workspace-sidebar");
  await expect(sidebar).toBeVisible();
  const sidebarTop = await sidebar.evaluate(
    (el) => getComputedStyle(el).top
  );
  expect(sidebarTop).toBe("30px");
});