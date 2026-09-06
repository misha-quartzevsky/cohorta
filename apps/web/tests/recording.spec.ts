/**
 * ============================================
 *  tests/recording.spec.ts — режим записи («диктофон» в Firefox)
 * ============================================
 *
 * Firefox не поддерживает Web Speech API, поэтому здесь проверяется именно
 * логика переключения режимов (из диктовки в простой диктофон):
 * клик по микрофону переводит приложение в audioOnly-режим, и в DOM
 * появляются индикаторы записи — класс `.is-recording` на «листе»,
 * активная кнопка и красный бейдж «● REC».
 *
 * Микрофон живёт в шапке приложения (`.header-mic`) — плавающая кнопка на
 * «листе» убрана (UX-фиксы демо: на длинном конспекте она уезжала от места
 * набора).
 *
 * Сценарий:
 *   1. Вход в лекцию в режиме редактирования (карточка-«лист»).
 *   2. Клик по микрофону в шапке `.header-mic`.
 *   3. В DOM появляется индикатор: `.tiptap-wrapper.is-recording` + `.header-rec`.
 *   4. Повторный клик («Стоп») — индикатор исчезает.
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Примечание: Playwright-Firefox не умеет выдавать разрешение "microphone"
// через context.permissions (Unknown permission). Это и не нужно — индикатор
// записи (`.is-recording`) выставляется в begin() синхронно, до async
// getUserMedia, поэтому тест детерминирован без микрофона.

test("клик по микрофону включает индикатор записи (диктофон), повторный — выключает", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // Редактирование лекции с сид-данными.
  await page.goto("/s/demo/math-analysis/limit-of-sequence/edit");
  await expect(page.locator(".tiptap-editor")).toBeVisible();

  // В Firefox (нет Web Speech API) кнопка работает в режиме «диктофона»:
  // иконка AudioLines + подпись «Диктофон» + title с подсказкой.
  const mic = page.locator(".header-mic");
  await expect(mic).toBeVisible();
  await expect(mic).toHaveAttribute("title", /Диктофон/);

  // До записи индикатора нет.
  await expect(page.locator(".tiptap-wrapper.is-recording")).toHaveCount(0);

  // Старт записи → появляется индикатор на «листе» и бейдж REC.
  // Клики по кнопке микрофона — через dispatchEvent: headed-Firefox
  // хронически завешивает `.click()` на кнопках в шапке (тот же флак, что с
  // кнопкой «Войти» — см. helpers.ts).
  await mic.dispatchEvent("click");
  await expect(page.locator(".tiptap-wrapper.is-recording")).toHaveCount(1, {
    timeout: 8000,
  });
  await expect(page.locator(".header-mic.active")).toHaveCount(1);
  await expect(page.locator(".header-rec")).toBeVisible();

  // «Стоп».
  await mic.dispatchEvent("click");
  await expect(page.locator(".tiptap-wrapper.is-recording")).toHaveCount(0, {
    timeout: 8000,
  });
  await expect(page.locator(".header-rec")).toHaveCount(0);
});
