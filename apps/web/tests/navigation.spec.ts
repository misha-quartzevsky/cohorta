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
  await expect(page.locator(".hero-greeting")).toBeVisible();

  const courses = page.locator(".courses-widget");
  const demoCourse = courses.locator(".course-card", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, demoCourse);
  await expect(demoCourse).toBeVisible();

  async function switchSemester(slug: string): Promise<void> {
    // dispatchEvent, а не click: кнопка семестра в сайдбаре не «успокаивается»
    // для headed-Firefox (hover/content-in анимации), штатный клик висит до
    // таймаута. Тот же приём уже используется в app-shell.spec для этой кнопки.
    await page.locator(".sidebar-semester-btn").dispatchEvent("click");
    await page
      .locator(".sidebar-semester-item", { hasText: `${slug} семестр` })
      .first()
      .dispatchEvent("click");
    await page.waitForURL(`**/s/${slug}`);
  }

  // Семестр «1» (миграции; на локальной БД там могут лежать legacy-курсы):
  // список курсов ДРУГОЙ — «Математический анализ» из demo в секции «Курсы»
  // отсутствует. Проверяем именно смену списка, а не пустоту семестра.
  await switchSemester("1");
  await expect(page.locator(".hero-greeting")).toBeVisible();
  await expect(
    page
      .locator(".courses-widget")
      .locator(".course-card", { hasText: "Математический анализ" })
  ).toHaveCount(0);

  // Обратно на demo: курсы снова на месте.
  await switchSemester("demo");
  await expect(page.locator(".hero-greeting")).toBeVisible();
  await expect(
    page.locator(".courses-widget .course-card", {
      hasText: "Математический анализ",
    })
  ).toBeVisible();
});
