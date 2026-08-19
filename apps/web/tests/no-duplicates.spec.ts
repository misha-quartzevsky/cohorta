/**
 * ============================================
 *  tests/no-duplicates.spec.ts — проверка структуры app-shell
 * ============================================
 *
 * Регрессия на дублирование лейаута: ровно один GlobalSidebar
 * (.global-sidebar) как на дашборде, так и на лекции, и НИ ОДНОГО
 * старого .workspace-sidebar (он удалён при переходе на глобальный сайдбар).
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("ровно один .global-sidebar и ни одного .workspace-sidebar", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // Дашборд.
  await expect(page.locator(".global-sidebar")).toHaveCount(1);
  await expect(page.locator(".workspace-sidebar")).toHaveCount(0);
  await expect(page.locator(".app-main")).toHaveCount(1);

  // Курс.
  await page
    .locator(".dashboard-section")
    .first()
    .locator(".tile-click", { hasText: "Математический анализ" })
    .click();
  await page.waitForURL("**/s/demo/math-analysis");
  await expect(page.locator(".global-sidebar")).toHaveCount(1);
  await expect(page.locator(".workspace-sidebar")).toHaveCount(0);

  // Лекция.
  await page
    .locator(".tile-click", { hasText: "Предел последовательности" })
    .first()
    .click();
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );
  await expect(page.locator(".global-sidebar")).toHaveCount(1);
  await expect(page.locator(".workspace-sidebar")).toHaveCount(0);
});