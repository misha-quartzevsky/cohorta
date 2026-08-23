/**
 * ============================================
 *  tests/helpers.ts — shared E2E helpers
 * ============================================
 *
 * Демо-доступы и логин-утилита для всех спецификаций Playwright.
 */

import type { Locator, Page } from "@playwright/test";

export const DEMO_EMAIL = "asyaobraz17@gmail.com";
export const DEMO_PASSWORD = "12345678";

/** localStorage-ключ последнего семестра (см. lib/semesterContext.ts). */
export const LAST_SEMESTER_KEY = "cohorta:lastSemester";

/**
 * Ждёт, пока элемент (плитка) перестанет двигаться после CSS-анимации
 * `content-in`. Документный `document.getAnimations()` тут не подходит:
 * в шапке навсегда «пульсирует» кнопка микрофона (`mic-pulse infinite`).
 * Стабильность меряем по boundingBox локатора.
 */
export async function waitForStable(
  page: Page,
  locator: Locator
): Promise<void> {
  await locator.waitFor({ state: "visible" });
  let last = await locator.boundingBox();
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(60);
    const box = await locator.boundingBox();
    if (!box) continue;
    if (
      last &&
      Math.abs(box.x - last.x) < 0.5 &&
      Math.abs(box.y - last.y) < 0.5 &&
      Math.abs(box.width - last.width) < 0.5 &&
      Math.abs(box.height - last.height) < 0.5
    ) {
      return;
    }
    last = box;
  }
}

/**
 * Логинит демо-пользователя. До загрузки приложения выставляет
 * localStorage-слаг семестра, чтобы HomeRedirect попал ровно в него,
 * а редирект после входа был детерминированным.
 */
export async function login(page: Page, semesterSlug: string): Promise<void> {
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: semesterSlug }
  );
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  const password = page.locator('input[type="password"]');
  await password.fill(DEMO_PASSWORD);
  // Отправляем форму Enter'ом, а не кликом по «Войти». Клик по этой кнопке
  // хронически завешивал прогон в headed-Firefox: Playwright доходил до
  // «performing click action» и висел до таймаута 60 с (тот же флак, из-за
  // которого клики по сайдбару делаются через dispatchEvent). Enter идёт по
  // клавиатурному пути, вызывает тот же onSubmit и не залипает.
  await password.press("Enter");
}