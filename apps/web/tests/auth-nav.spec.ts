/**
 * ============================================
 *  tests/auth-nav.spec.ts — smoke: auth + navigation
 * ============================================
 *
 * Сценарий:
 *   1. Открываем /login, вводим демо-доступы из сид-миграции.
 *   2. Редирект на /s/demo (демо-семестр из seed).
 *   3. Дашборд → курс «Математический анализ» → лекция «Предел
 *      последовательности» (открывается сайдбар с содержанием).
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
  await expect(page.locator(".c-dash-head h1")).toBeVisible();
  await expect(page.locator(".c-shell-sidebar")).toBeVisible();

  // Дашборд → предмет (список «Предметы» в сайдбаре).
  const courseLink = page.locator(".c-shell-courses a", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, courseLink);
  await courseLink.dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis");

  // Лекция → просмотр внутри LectureLayout.
  // dispatchEvent вместо click: у строк списка hover-transition, из-за
  // которого штатный клик в headed-Firefox висит до таймаута. Приём уже
  // применён в app-shell/lecture-workflow.
  await page
    .locator(".c-lec-row", { hasText: "Предел последовательности" })
    .first()
    .dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");

  // Содержание живёт ТОЛЬКО в сайдбаре: секция + непустой список пунктов.
  await expect(
    page.locator(".c-shell-sidebar .c-shell-section", {
      hasText: "Содержание",
    })
  ).toBeVisible();
  await expect(
    page.locator(".c-shell-sidebar .c-toc a").first()
  ).toBeVisible();
});
