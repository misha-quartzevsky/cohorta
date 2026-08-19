/**
 * ============================================
 *  tests/navigation.spec.ts — переключение семестров
 * ============================================
 *
 * Переключатель семестра в GlobalSidebar (попап из `.sidebar-semester-btn`)
 * меняет URL и список курсов:
 *   1. Семестр demo (seed): в «Курсах» виден «Математический анализ».
 *   2. Семестр «1» (миграции): секция «Курсы» показывает другой список —
 *      «Математический анализ» из demo отсутствует.
 *   3. Возврат на demo: курсы снова на месте.
 */

import { test, expect } from "@playwright/test";
import { login, waitForStable } from "./helpers";

test("переключение семестра в сайдбаре меняет список курсов", async ({
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

  async function switchSemester(slug: string): Promise<void> {
    await page.locator(".sidebar-semester-btn").click();
    await page
      .locator(".sidebar-semester-item", { hasText: `${slug} семестр` })
      .first()
      .click();
    await page.waitForURL(`**/s/${slug}`);
  }

  // Семестр «1» (миграции; на локальной БД там могут лежать legacy-курсы):
  // список курсов ДРУГОЙ — «Математический анализ» из demo в секции «Курсы»
  // отсутствует. Проверяем именно смену списка, а не пустоту семестра.
  await switchSemester("1");
  await expect(page.locator(".page-title")).toContainText("Семестр 1");
  await expect(
    page
      .locator(".dashboard-section")
      .first()
      .locator(".tile-click", { hasText: "Математический анализ" })
  ).toHaveCount(0);

  // Обратно на demo: курсы снова на месте.
  await switchSemester("demo");
  await expect(page.locator(".page-title")).toContainText("Семестр demo");
  await expect(
    page.locator(".dashboard-section").first().locator(".tile-click", {
      hasText: "Математический анализ",
    })
  ).toBeVisible();
});
