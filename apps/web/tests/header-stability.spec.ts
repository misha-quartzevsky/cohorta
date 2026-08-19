/**
 * ============================================
 *  tests/header-stability.spec.ts — «дёрганье» шапки
 * ============================================
 *
 * Сценарий (seed-only — проходит и на свежей БД после `npm run seed`):
 *   1. Дашборд семестра demo → курс «Математический анализ» →
 *      лекция «Предел последовательности».
 *   2. Замер boundingBox .app-header (y, height).
 *   3. Переход на другую лекцию из сайдбара
 *      (.lecture-side-item:not(.active)).
 *   4. Повторный замер. Сдвиг y или height более чем на 0.5px
 *      падает с «Layout Shift detected in Header».
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { login, waitForStable } from "./helpers";

async function measureHeader(page: Page) {
  const box = await page.locator(".app-header").boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("шапка не «дёргается» при переключении лекций из сайдбара", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await expect(page.locator(".page-title")).toContainText("Семестр demo");

  // Дашборд → курс «Математический анализ» → лекция «Предел последовательности».
  const courseTile = page
    .locator(".dashboard-section")
    .first()
    .locator(".tile-click", { hasText: "Математический анализ" });
  await waitForStable(page, courseTile);
  await courseTile.click();
  await page.waitForURL("**/s/demo/math-analysis");
  await page
    .locator(".tile-click", { hasText: "Предел последовательности" })
    .click();
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );
  await expect(page.locator(".workspace-sidebar")).toBeVisible();

  const before = await measureHeader(page);

  // Быстрый переход на другую лекцию из сайдбара (любую, кроме активной).
  const other = page.locator(".lecture-side-item:not(.active)").first();
  await expect(other).toBeVisible();
  await other.click();

  await page.waitForURL((url) => !url.pathname.endsWith("limit-of-sequence"));
  const title = page.locator(".lecture-card-title");
  await title.waitFor({ state: "attached" });
  await expect(title).not.toHaveText("Предел последовательности");

  const after = await measureHeader(page);

  const dy = Math.abs(after.y - before.y);
  const dh = Math.abs(after.height - before.height);
  expect(dy, "Layout Shift detected in Header").toBeLessThanOrEqual(0.5);
  expect(dh, "Layout Shift detected in Header").toBeLessThanOrEqual(0.5);
});
