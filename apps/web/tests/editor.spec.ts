/**
 * ============================================
 *  tests/editor.spec.ts — inline-редактирование, формулы MathLive, автосейв
 * ============================================
 *
 * Сценарий (Notion-style: отдельного /edit-режима нет):
 *   1. SPA-навигация на лекцию с формулой: блок [data-type='math-block']
 *      отрисован в <math-div> СРАЗУ — без ручной перезагрузки страницы
 *      (регрессия «формулы появляются только после reload»).
 *   2. Клик в тело записи → на его месте лениво монтируется Tiptap-редактор;
 *      формула рендерится и внутри редактора (NodeView).
 *   3. Правка контента → автосохранение (debounce ~1.2 с) → reload →
 *      сохранённая правка на месте.
 *   4. Клик в середину абзаца ставит каретку в точку клика (не в конец).
 *
 * Завязан на сид-данные: семестр demo, курс «Математический анализ»,
 * лекция «Предел последовательности» (содержит inline-формулу).
 */

import { test, expect } from "@playwright/test";
import { login, waitForStable } from "./helpers";

async function openLimitLecture(page: import("@playwright/test").Page) {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  const courseTile = page.locator(".course-row", {
    hasText: "Математический анализ",
  });
  await waitForStable(page, courseTile);
  await courseTile.dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis");
  // dispatchEvent, а не click: у `.tile-click` hover-transform (transition
  // 0.18s), из-за которого штатный клик в headed-Firefox висит до таймаута.
  await page
    .locator(".tile-click", { hasText: "Предел последовательности" })
    .first()
    .dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis/limit-of-sequence");
}

test("формула видна сразу; клик в тело открывает редактор; автосейв сохраняет правку", async ({
  page,
}) => {
  await openLimitLecture(page);

  const view = page.locator(".lecture-view-content");
  await expect(view.locator("[data-type='math-block']").first()).toBeVisible();
  // Главная регрессия: <math-div> отрендерен сразу после SPA-навигации.
  await expect(view.locator("math-div.math-render").first()).toBeVisible({
    timeout: 8000,
  });

  // Клик в тело записи → на месте статичного HTML монтируется редактор.
  await view.click();
  await expect(page.locator(".tiptap-editor")).toBeVisible({ timeout: 15000 });
  // NodeView формулы смонтирован в редакторе (пиксельная видимость зависит
  // от прокрутки к каретке — проверяем факт рендера, не bounding box).
  await expect(
    page
      .locator(".tiptap-wrapper .math-block-render math-div.math-render")
      .first()
  ).toBeAttached({ timeout: 15000 });

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

  // Reload → тело снова статично, но сохранённая правка на месте.
  await page.reload();
  await expect(page.locator(".lecture-view-content")).toContainText(marker, {
    timeout: 15000,
  });
});

test("шапка записи показывает человекочитаемую дату, а не сырую строку PocketBase", async ({
  page,
}) => {
  await openLimitLecture(page);

  const meta = page.locator(".lecture-card-meta").first();
  await expect(meta).toBeVisible({ timeout: 15000 });
  const text = ((await meta.textContent()) ?? "").trim();

  // Русская дата вида «15 января 2026 г.» — есть день, слово-месяц и год.
  expect(text).toMatch(/\d{1,2}\s+\p{L}+\s+\d{4}/u);
  // И никакого «Invalid Date» или сырого ISO с разделителем-пробелом/‘Z’.
  expect(text).not.toContain("Invalid");
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/);
});

test("/edit — алиас: страница открывается сразу в редакторе", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/s/demo/math-analysis/limit-of-sequence/edit");
  // Без клика по телу — редактор смонтирован сразу.
  await expect(page.locator(".tiptap-editor")).toBeVisible({ timeout: 15000 });
});

test("клик в середину абзаца ставит каретку в точку клика", async ({ page }) => {
  await openLimitLecture(page);

  // Первый НЕпустой абзац (в контенте есть ведущий <p></p> от сидера).
  const firstPara = page
    .locator(".lecture-view-content p")
    .filter({ hasText: /\S/ })
    .first();
  await expect(firstPara).toBeVisible();
  const originalText = ((await firstPara.textContent()) ?? "").trim();
  expect(originalText.length).toBeGreaterThan(0);

  // Нативный клик мышью у самого начала первого абзаца. Координаты клика
  // уходят в Editor → posAtCoords → каретка встаёт в эту точку.
  const box = (await firstPara.boundingBox())!;
  await page.mouse.click(box.x + 3, box.y + box.height / 2);

  // Ждём монтирования редактора и передачи каретки (эффект после paint).
  const editable = page.locator(".tiptap-editor");
  await expect(editable).toBeVisible({ timeout: 15000 });

  // Клик был у верха документа → каретка должна оказаться в одном из первых
  // блоков, а НЕ в конце (как было бы при фолбэке focus("end")). Точное
  // попадание «блок в блок» зависит от рскладки, поэтому проверяем зону.
  // Печатать нельзя: в headed-Firefox без фокуса окна keyboard не попадает
  // в contenteditable — читаем DOM-выделение.
  const blockInfo = () =>
    page.evaluate(() => {
      const root = document.querySelector(".tiptap-editor");
      const s = window.getSelection();
      const total = root ? root.children.length : 0;
      if (!root || !s || s.rangeCount === 0 || !s.anchorNode)
        return { idx: -1, total };
      if (s.anchorNode === root) return { idx: s.anchorOffset, total };
      let el =
        s.anchorNode.nodeType === 3
          ? s.anchorNode.parentElement
          : (s.anchorNode as Element);
      while (el && el.parentElement !== root) el = el.parentElement;
      return { idx: el ? Array.from(root.children).indexOf(el) : -1, total };
    });

  await expect.poll(() => blockInfo().then((b) => b.total), {
    timeout: 15000,
  }).toBeGreaterThan(4);
  const { idx, total } = await blockInfo();
  expect(idx, `каретка в блоке ${idx} из ${total}`).toBeGreaterThanOrEqual(0);
  expect(idx, `каретка должна быть у верха, а не в конце`).toBeLessThan(
    Math.ceil(total / 2)
  );
});
