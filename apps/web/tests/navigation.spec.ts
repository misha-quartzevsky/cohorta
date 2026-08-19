/**
 * ============================================
 *  tests/navigation.spec.ts — переключение семестров
 * ============================================
 *
 * Переключатель семестра в шапке (#semester-select) меняет URL и список курсов:
 *   1. Семестр demo (seed): в «Курсах» виден «Математический анализ».
 *   2. Пустой семестр «1» (миграции): секция «Курсы» показывает заглушку.
 *   3. Возврат на demo: курсы снова на месте.
 */

import { test, expect } from "@playwright/test";
import { login, waitForStable } from "./helpers";

test("переключение семестра в шапке меняет список курсов", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await expect(page.locator(".page-title")).toContainText("Семестр demo");

  const courses = page.locator(".dashboard-section").first();
  const demoCourse = courses.locator(".tile-click", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, demoCourse);
  await expect(demoCourse).toBeVisible();

  // Семестр «1» (миграции; на локальной БД там могут лежать legacy-курсы):
  // список курсов ДРУГОЙ — «Математический анализ» из demo в секции «Курсы»
  // отсутствует. Проверяем именно смену списка, а не пустоту семестра.
  await page.selectOption("#semester-select", "1");
  await page.waitForURL("**/s/1");
  await expect(page.locator(".page-title")).toContainText("Семестр 1");
  await expect(
    page
      .locator(".dashboard-section")
      .first()
      .locator(".tile-click", { hasText: "Математический анализ" })
  ).toHaveCount(0);

  // Обратно на demo: курсы снова на месте.
  await page.selectOption("#semester-select", "demo");
  await page.waitForURL("**/s/demo");
  await expect(page.locator(".page-title")).toContainText("Семестр demo");
  await expect(
    page.locator(".dashboard-section").first().locator(".tile-click", {
      hasText: "Математический анализ",
    })
  ).toBeVisible();
});
