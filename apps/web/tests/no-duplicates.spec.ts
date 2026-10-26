/**
 * ============================================
 *  tests/no-duplicates.spec.ts — проверка структуры app-shell
 * ============================================
 *
 * Регрессия на дублирование лейаута: ровно один GlobalSidebar
 * (.c-shell-sidebar) как на дашборде, так и на лекции, и НИ ОДНОГО
 * старого .workspace-sidebar (он удалён при переходе на глобальный сайдбар).
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("ровно один .c-shell-sidebar и ни одного .workspace-sidebar", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // Дашборд.
  await expect(page.locator(".c-shell-sidebar")).toHaveCount(1);
  await expect(page.locator(".workspace-sidebar")).toHaveCount(0);
  await expect(page.locator(".c-shell-main")).toHaveCount(1);

  // Курс (список «Предметы» в сайдбаре).
  await page
    .locator(".c-shell-courses a", { hasText: "Математический анализ" })
    .dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis");
  await expect(page.locator(".c-shell-sidebar")).toHaveCount(1);
  await expect(page.locator(".workspace-sidebar")).toHaveCount(0);

  // Лекция.
  // dispatchEvent вместо click: у плиток/карточек hover-transform
  // (transition 0.18s), из-за которого штатный клик в headed-Firefox
  // висит до таймаута. Приём уже применён в app-shell/lecture-workflow.
  await page
    .locator(".c-lec-row", { hasText: "Предел последовательности" })
    .first()
    .dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");
  await expect(page.locator(".lecture-title-input")).toHaveValue(
    "Предел последовательности"
  );
  await expect(page.locator(".c-shell-sidebar")).toHaveCount(1);
  await expect(page.locator(".workspace-sidebar")).toHaveCount(0);
});