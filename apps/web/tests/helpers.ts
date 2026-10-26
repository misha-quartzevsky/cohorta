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
 * Клик по кнопке «Далее» (на последнем шаге «Готово») мастера онбординга.
 * Через dispatchEvent — обычный .click() хронически завешивает headed-Firefox
 * на «performing click action» (тот же флак, что для сайдбара/логина).
 */
export async function onbNext(page: Page): Promise<void> {
  const next = page.getByRole("button", { name: /^(Далее|Готово)$/ });
  await expect(next).toBeEnabled();
  await next.dispatchEvent("click");
}

/**
 * Клик по первому элементу по CSS-селектору (dispatchEvent). Остался от прежнего
 * мастера: им пользуются тесты, которые ждут решения (логин, правка периодов).
 */
export async function onbPick(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().waitFor({ state: "visible" });
  await page.locator(selector).first().dispatchEvent("click");
}

/** Клик по кнопке мастера по её видимому названию («Бакалавриат», «Семестры», …). */
export async function onbChip(page: Page, name: string): Promise<void> {
  const chip = page.getByRole("button", { name, exact: true });
  await chip.waitFor({ state: "visible" });
  await chip.dispatchEvent("click");
}

/**
 * Шаги 1–2 мастера: имя и «город + первый вуз из справочника».
 * Останавливается на шаге «Уровень и курс».
 */
export async function onbNameAndUniversity(page: Page, name = "E2E Тест"): Promise<void> {
  // Шаг 1 — имя
  await page.getByLabel("Как тебя зовут").fill(name);
  await onbNext(page);

  // Шаг 2 — город и вуз. Подсказки города появляются, когда подгрузится справочник.
  await page.getByLabel("Город").fill("Москва");
  const city = page.locator(".c-onb-sugg button", { hasText: "Москва" }).first();
  await city.waitFor({ state: "visible" });
  await city.dispatchEvent("click");
  const uni = page.getByRole("option").first();
  await uni.waitFor({ state: "visible" });
  await uni.dispatchEvent("click");
  await onbNext(page);
}

/**
 * Проходит мастер онбординга (4 шага) по кратчайшему пути и оставляет
 * пользователя в приложении. После регистрации новый аккаунт попадает на
 * `/onboarding`: пока он не пройден, нет ни одного периода, и маршруты
 * `/s/:slug` недоступны. Бакалавриат, 1 курс, семестры: 8 периодов (slug «1»…«8»),
 * `/s/1` существует сразу после вызова.
 */
export async function completeOnboardingFast(page: Page): Promise<void> {
  await page.waitForURL(/\/onboarding$/);
  await onbNameAndUniversity(page);

  // Шаг 3 — уровень и курс
  await onbChip(page, "Бакалавриат");
  await page.getByRole("button", { name: "1 курс", exact: true }).dispatchEvent("click");
  await onbNext(page);

  // Шаг 4 — период (семестры по умолчанию), «Готово»
  await onbNext(page);

  // Мастер завершается переходом на «/» с дашбордом.
  await expect(page.locator(".c-dash")).toBeVisible();
}

/** Открывает /login и переключает форму в режим регистрации. */
export async function openRegister(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "1" }
  );
  await page.goto("/login");
  // dispatchEvent — тот же приём, что для сайдбара: обходит click-флак headed-Firefox.
  await page.locator(".c-auth-switch a").dispatchEvent("click");
  await expect(page.locator(".c-auth-head h1")).toHaveText("Регистрация в cohorta");
}

/** Заполняет форму регистрации и отправляет её Enter'ом. */
export async function submitRegister(
  page: Page,
  email: string,
  password: string,
  confirm: string
): Promise<void> {
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(password);
  await pw.nth(1).fill(confirm);
  await pw.nth(1).press("Enter");
}

/**
 * Регистрирует новый аккаунт и оставляет его на /onboarding. Возвращает email.
 */
export async function registerBare(page: Page, prefix = "e2e"): Promise<string> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await openRegister(page);
  await submitRegister(page, email, "test12345", "test12345");
  await page.waitForURL(/\/onboarding$/);
  return email;
}

/** Регистрация + мастер онбординга: аккаунт в приложении на дашборде. Возвращает email. */
export async function registerFresh(page: Page, prefix = "e2e"): Promise<string> {
  const email = await registerBare(page, prefix);
  await completeOnboardingFast(page);
  return email;
}

/**
 * Переходит на лекцию через поиск (кнопка «Поиск» в сайдбаре): прямая SPA-навигация
 * лекция → лекция без промежуточных страниц, как раньше из списка лекций в сайдбаре.
 */
export async function openLectureViaSearch(page: Page, query: string, title: string): Promise<void> {
  await page.locator(".c-shell-side-search").dispatchEvent("click");
  await page.getByPlaceholder("Лекции, предметы, одногруппники").fill(query);
  const hit = page.locator(".c-search-results .c-row", { hasText: title }).first();
  await hit.waitFor({ state: "visible" });
  await hit.dispatchEvent("click");
}

/**
 * Переходит на другую лекцию того же предмета: крошка «Предмет» → строка списка.
 * В новом сайдбаре на лекции показано только содержание, списка лекций курса в нём нет.
 */
export async function openOtherLectureOfCourse(page: Page, course: string, title: string): Promise<void> {
  await page.locator(".c-shell-crumbs a", { hasText: course }).dispatchEvent("click");
  await page.locator(".c-lec-row", { hasText: title }).first().dispatchEvent("click");
}

/**
 * Проверяет email вошедшего пользователя. В новом интерфейсе он показан в
 * «Профиль и настройки» (/settings), куда ведёт блок профиля в сайдбаре.
 */
export async function expectAccountEmail(page: Page, email: string): Promise<void> {
  await page.locator(".c-shell-profile").dispatchEvent("click");
  await expect(page.locator(".c-settings-me .e")).toHaveText(email);
}

/**
 * Выход из аккаунта. В новом интерфейсе кнопка «Выйти» есть только в «Профиле»
 * на узкой ширине (/profile), на десктопе её нет (см. «Разбор Playwright», класс C),
 * поэтому выходим через узкую ширину и возвращаем прежний размер окна.
 */
export async function logout(page: Page): Promise<void> {
  const size = page.viewportSize();
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/profile");
  await page.getByText("Выйти", { exact: true }).dispatchEvent("click");
  await page.waitForURL("**/login");
  if (size) await page.setViewportSize(size);
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