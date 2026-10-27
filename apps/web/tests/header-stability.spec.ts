/**
 * ============================================
 *  tests/header-stability.spec.ts — «дёрганье» шапки
 * ============================================
 *
 * Сценарий (seed-only — проходит и на свежей БД после `npm run seed`):
 *   1. Дашборд семестра demo → курс «Математический анализ» →
 *      лекция «Предел последовательности».
 *   2. Замер boundingBox .c-shell-topbar (y, height).
 *   3. Переход на другую лекцию курса через поиск (списка лекций в новом
 *      сайдбаре нет).
 *   4. Повторный замер. Сдвиг y или height более чем на 0.5px
 *      падает с «Layout Shift detected in Header».
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { login, openLectureViaSearch, waitForStable } from "./helpers";

async function measureHeader(page: Page) {
  const box = await page.locator(".c-shell-topbar").boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("шапка не «дёргается» при переключении лекций из сайдбара", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await expect(page.locator(".c-dash-head h1")).toBeVisible();

  // Дашборд → курс «Математический анализ» → лекция «Предел последовательности».
  const courseTile = page.locator(".c-shell-courses a", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, courseTile);
  // dispatchEvent вместо click: у плиток/карточек hover-transform
  // (transition 0.18s), из-за которого штатный клик в headed-Firefox
  // висит до таймаута. Приём уже применён в app-shell/lecture-workflow.
  await courseTile.dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis");
  await page
    .locator(".c-lec-row", { hasText: "Предел последовательности" })
    .first()
    .dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");
  await expect(page.locator(".lecture-title-input")).toHaveValue(
    "Предел последовательности"
  );
  await expect(page.locator(".c-shell-sidebar .c-toc a").first()).toBeVisible();

  const before = await measureHeader(page);

  // Переход на другую лекцию курса через поиск (прямая SPA-навигация лекция → лекция).
  await openLectureViaSearch(page, "Производная функции", "Производная функции");

  await page.waitForURL((url) => !url.pathname.endsWith("limit-of-sequence"));
  const title = page.locator(".lecture-title-input");
  await title.waitFor({ state: "attached" });
  await expect(title).not.toHaveValue("Предел последовательности");

  const after = await measureHeader(page);

  const dy = Math.abs(after.y - before.y);
  const dh = Math.abs(after.height - before.height);
  expect(dy, "Layout Shift detected in Header").toBeLessThanOrEqual(0.5);
  expect(dh, "Layout Shift detected in Header").toBeLessThanOrEqual(0.5);
});
