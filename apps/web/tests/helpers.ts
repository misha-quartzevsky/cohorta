/**
 * ============================================
 *  tests/helpers.ts — shared E2E helpers
 * ============================================
 *
 * Демо-доступы и логин-утилита для всех спецификаций Playwright.
 */

import { expect, type Locator, type Page } from "@playwright/test";

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
 * Клик по кнопке «Далее» мастера. Через dispatchEvent — обычный
 * .click() по .onb-next хронически завешивает headed-Firefox на
 * «performing click action» (тот же флак, что для сайдбара/логина).
 */
export async function onbNext(page: Page): Promise<void> {
  await expect(page.locator(".onb-next")).toBeEnabled();
  await page.locator(".onb-next").dispatchEvent("click");
}

/** Клик по выбираемому элементу мастера (плитка/пилюля/пункт списка). */
export async function onbPick(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().waitFor({ state: "visible" });
  await page.locator(selector).first().dispatchEvent("click");
}

/**
 * Проходит мастер онбординга по кратчайшему пути и оставляет
 * пользователя в приложении. После регистрации новый аккаунт
 * попадает на `/onboarding` — без этого шага нет ни одного периода
 * и роуты `/s/:slug` недоступны.
 *
 * По умолчанию создаёт `count` семестров (slug "1".."count"), так что
 * `/s/1` существует сразу после вызова.
 */
export async function completeOnboardingFast(
  page: Page,
  opts: { username?: string; count?: number } = {}
): Promise<void> {
  // Логин = поддомен: только [a-z0-9-], поэтому дефисы, не подчёркивания.
  const username =
    opts.username ??
    `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const count = opts.count ?? 2;

  await page.waitForURL(/\/onboarding$/);

  // Шаг 1 — имя
  await page.locator("#onb-name").fill("E2E Тест");
  await onbNext(page);

  // Шаг 2 — адрес профиля (логин)
  await page.locator("#onb-username").fill(username);
  await onbNext(page);

  // Шаг 3 — город + вуз. Ждём, пока подгрузится справочник городов
  // (пункт "нет в списке" — .onb-combo-item--muted — не наш выбор).
  await page.locator("#onb-city").fill("Москва");
  await onbPick(
    page,
    '.onb-combo-item:not(.onb-combo-item--muted):has-text("Москва")'
  );
  await onbPick(page, ".onb-option:not(.onb-option--dashed)");
  await onbNext(page);

  // Шаг 4 — ступень
  await onbPick(page, '.onb-option:has-text("Бакалавриат")');
  await onbNext(page);

  // Шаг 5 — курс
  await onbPick(page, '.onb-pill:has-text("1")');
  await onbNext(page);

  // Шаг 6 — тип периода
  await onbPick(page, '.onb-option:has-text("Семестры")');
  await onbNext(page);

  // Шаг 7 — количество и генерация
  await page.locator("#onb-count").fill(String(count));
  await page.locator('.btn-primary:has-text("Создать")').dispatchEvent("click");
  await expect(page.locator(".onb-period-row")).toHaveCount(count);
  await onbNext(page);

  // Шаг 8 — аватар пропускаем
  await onbNext(page);

  await page.waitForURL(/\/s\//);
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