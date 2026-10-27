/**
 * ============================================
 *  tests/navigation.spec.ts — выбор периода
 * ============================================
 *
 * Фильтр «Период» в «Все лекции» (Screen-lectures-period) меняет список лекций
 * (отдельного переключателя семестра в сайдбаре нет, решение Д3):
 *   1. Период «Демо-семестр» (seed): среди лекций есть предмет «Математический анализ».
 *   2. Период «Семестр 1»: лекций этого предмета нет.
 *   3. Возврат на «Демо-семестр»: лекции снова на месте.
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("выбор периода меняет список лекций", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/s/demo/lectures");

  const demoLecture = page.locator(".c-lec-row", { hasText: "Математический анализ" });
  await expect(demoLecture.first()).toBeVisible();

  async function pickPeriod(name: string | RegExp): Promise<void> {
    await page.locator(".c-lec-period.wide").click();
    await page.locator(".c-lec-period-list").getByRole("option", { name }).click();
    await expect(page.locator(".c-lec-period-list")).toHaveCount(0);
  }

  // «Семестр 1» (миграции; на локальной БД там могут лежать legacy-лекции):
  // лекций «Математического анализа» из demo там нет. Проверяем именно смену списка.
  await pickPeriod(/^Семестр 1$/);
  await expect(page.locator(".c-lec-period.wide")).toContainText("Семестр 1");
  await expect(demoLecture).toHaveCount(0);

  // Обратно на «Демо-семестр»: лекции снова на месте.
  await pickPeriod(/^Демо-семестр/);
  await expect(demoLecture.first()).toBeVisible();
});
