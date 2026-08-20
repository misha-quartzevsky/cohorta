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
  const courseTile = page.locator(".course-mini-card", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, courseTile);
  await courseTile.click();
  await page.waitForURL("**/s/demo/math-analysis");

  // Лекция → просмотр внутри LectureLayout.
  await page
    .locator(".tile-click", { hasText: "Предел последовательности" })
    .first()
    .click();
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");

  // Правый TOC-асид (внутри LectureLayout поверх карточки):
  // наличие + корректный sticky-отступ 30px от верха.
  const toc = page.locator(".workspace-toc");
  await expect(toc).toBeVisible();
  const tocTop = await toc.evaluate((el) => getComputedStyle(el).top);
  expect(tocTop).toBe("30px");
});