/**
 * ============================================
 *  tests/timestamps.spec.ts — таймстамп строки при наведении
 * ============================================
 *
 * Фичу проставляет диктовка (SpeechProvider + NodeTimestamp): первая фраза
 * блока «застолбляет» атрибуты `data-ts` / `data-ts-label`. Диктовку в
 * Playwright не воспроизвести, поэтому проверяем слой рендера: сид-конспект
 * «Производная функции» содержит заранее размеченный абзац, hover по нему
 * показывает тултип с локальным временем (чистый CSS `::after`).
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const TS_LABEL = "6 сент., 14:32";

test("наведение на строку с таймстампом показывает время записи", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  await page.goto("/s/demo/math-analysis/derivative-geometry");
  await expect(page.locator(".lecture-view-content")).toBeVisible();

  // Данные есть: ровно один размеченный абзац с обоими атрибутами.
  const stamped = page.locator(".lecture-view-content p[data-ts]");
  await expect(stamped).toHaveCount(1);
  await expect(stamped).toHaveAttribute("data-ts-label", TS_LABEL);

  // UI рендерится: hover → CSS `::after` подставляет подпись времени.
  // Firefox не резолвит attr() в getComputedStyle(::after).content (отдаёт
  // сырое "attr(data-ts-label)"), Chrome — резолвит. Кроссбраузерно: правило
  // навелось (content не "none"/"normal") и элемент — позиционирующий контекст.
  await stamped.hover();
  const probe = await stamped.evaluate((el) => ({
    after: getComputedStyle(el, "::after").content,
    position: getComputedStyle(el).position,
  }));
  expect(probe.position).toBe("relative");
  expect(["none", "normal", ""]).not.toContain(probe.after);
  expect(probe.after === "attr(data-ts-label)" || probe.after.includes("14:32")).toBe(
    true
  );
});

test("редактор не теряет абзац с таймстампом (parseHTML принимает data-ts)", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  await page.goto("/s/demo/math-analysis/derivative-geometry/edit");
  await expect(page.locator(".tiptap-editor")).toBeVisible();

  // Узел с `data-ts` распознан и отрисован — текст абзаца на месте,
  // атрибут сохранён на узле (renderHTML вернёт его при getHTML()).
  const stamped = page.locator(".tiptap-editor p[data-ts]");
  await expect(stamped).toHaveCount(1);
  await expect(stamped).toContainText("приращения функции");
  await expect(stamped).toHaveAttribute("data-ts-label", TS_LABEL);
});
