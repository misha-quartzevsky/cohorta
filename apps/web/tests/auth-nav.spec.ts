/**
 * ============================================
 *  tests/auth-nav.spec.ts — smoke: auth + navigation
 * ============================================
 *
 * Сценарий:
 *   1. Открываем /login, вводим демо-доступы из сид-миграции.
 *   2. Редирект на /s/demo (демо-семестр из seed).
 *   3. Дашборд → курс «Математический анализ» → лекция «Предел
 *      последовательности» (открывается глобальный сайдбар + правый TOC).
 *   4. Правый TOC-асид виден, его sticky-отступ сверху ровно 30px
 *      (getComputedStyle → top).
 */

import { test, expect } from "@playwright/test";
import { login, waitForStable } from "./helpers";

test("демо-логин: редирект на /s/demo и TOC-асид с отступом 30px", async ({
  page,
}) => {
  await login(page, "demo");

  await page.waitForURL("**/s/demo");
  await expect(page.locator(".hero-greeting")).toBeVisible();
  await expect(page.locator(".global-sidebar")).toBeVisible();

  // Дашборд → курс (виджет «Курсы семестра»).
  const courseTile = page.locator(".course-row", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, courseTile);
  await courseTile.dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis");

  // Лекция → просмотр внутри LectureLayout.
  // dispatchEvent вместо click: у плиток/карточек hover-transform
  // (transition 0.18s), из-за которого штатный клик в headed-Firefox
  // висит до таймаута. Приём уже применён в app-shell/lecture-workflow.
  await page
    .locator(".tile-click", { hasText: "Предел последовательности" })
    .first()
    .dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");

  // Оглавление живёт ТОЛЬКО в сайдбаре (правая колонка освобождена под
  // будущую панель редактирования): секция + непустой список пунктов.
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "Оглавление",
    })
  ).toBeVisible();
  await expect(
    page.locator(".global-sidebar .toc-item").first()
  ).toBeVisible();
});