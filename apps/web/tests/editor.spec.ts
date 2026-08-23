/**
 * ============================================
 *  tests/editor.spec.ts — формулы MathLive + автосохранение
 * ============================================
 *
 * Сценарий:
 *   1. SPA-навигация на лекцию с формулой: блок [data-type='math-block']
 *      отрисован в <math-div> СРАЗУ — без ручной перезагрузки страницы
 *      (регрессия «формулы появляются только после reload»).
 *   2. Edit-режим: формула рендерится и внутри редактора (NodeView).
 *   3. Правка контента → автосохранение (debounce ~1.2 с) → reload →
 *      сохранённая правка на месте.
 *
 * Завязан на сид-данные: семестр demo, курс «Математический анализ»,
 * лекция «Предел последовательности» (содержит inline-формулу).
 */

import { test, expect } from "@playwright/test";
import { login, waitForStable } from "./helpers";

test("формула видна сразу при SPA-навигации; автосохранение сохраняет правку", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // SPA-переход на лекцию с формулой (клики по плиткам, без reload).
  const courseTile = page.locator(".course-card", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, courseTile);
  await courseTile.dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis");
  // dispatchEvent, а не click: у `.tile-click` hover-transform (transition
  // 0.18s), из-за которого штатный клик в headed-Firefox висит до таймаута —
  // тот же приём уже применён в lecture-workflow/app-shell.
  await page
    .locator(".tile-click", { hasText: "Предел последовательности" })
    .first()
    .dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");

  const view = page.locator(".lecture-view-content");
  await expect(view.locator("[data-type='math-block']").first()).toBeVisible();
  // Главная регрессия: <math-div> отрендерен сразу после SPA-навигации.
  await expect(view.locator("math-div.math-render").first()).toBeVisible({
    timeout: 8000,
  });

  // Edit-режим: NodeView формул тоже рендерит <math-div>.
  // dispatchEvent: та же болезнь headed-Firefox с «element not stable»,
  // что и у плиток/сайдбара — кнопка живёт в анимированной шапке карточки.
  await page.locator('button[title="Редактировать"]').dispatchEvent("click");
  await page.waitForURL("**/limit-of-sequence/edit");
  await expect(
    page
      .locator(".tiptap-wrapper .math-block-render math-div.math-render")
      .first()
  ).toBeVisible({ timeout: 8000 });

  // Правка контента: ставим курсор в конец документа и печатаем маркер.
  const marker = `e2e-marker-${Date.now()}`;
  const editable = page.locator(".tiptap-editor");
  await expect(editable).toBeVisible();
  await editable.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    (el as HTMLElement).focus();
  });
  await page.keyboard.type(marker);

  // Ждём автосохранение (debounce ~1.2 с + запрос) → «Обновлено только что».
  await expect(page.locator(".save-indicator.saved")).toContainText(
    "Обновлено только что",
    { timeout: 20000 }
  );

  // Reload → сохранённая правка на месте.
  await page.reload();
  await expect(page.locator(".tiptap-editor")).toContainText(marker, {
    timeout: 15000,
  });
});
