/**
 * ============================================
 *  tests/onboarding.spec.ts — мастер онбординга
 * ============================================
 *
 * Новый аккаунт после регистрации попадает на /onboarding и не
 * видит приложения, пока не пройдёт мастер (8 экранов). Проверяем:
 *  - полный проход → дашборд;
 *  - имя + формат адреса профиля (логин = поддомен);
 *  - коллизия логина;
 *  - эскейп «вуз не найден»;
 *  - пересчёт диапазона курса при смене ступени;
 *  - переименование/удаление периода;
 *  - пересоздание набора периодов без дублей.
 *
 * Клики по кнопкам мастера — через onbNext/onbPick (dispatchEvent):
 * обычный .click() по .onb-next завешивает headed-Firefox.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  LAST_SEMESTER_KEY,
  completeOnboardingFast,
  onbNext,
  onbPick,
} from "./helpers";

const PASSWORD = "test12345";

/** Валидный логин-поддомен из метки. */
const handle = (label: string) => `${label}-${Date.now().toString(36)}`;

/** Регистрирует новый аккаунт и оставляет его на /onboarding. */
async function registerBare(page: Page): Promise<string> {
  const email = `onb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "1" }
  );
  await page.goto("/login");
  await page.locator(".login-switch").dispatchEvent("click");
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(PASSWORD);
  await pw.nth(1).fill(PASSWORD);
  await pw.nth(1).press("Enter");
  await page.waitForURL(/\/onboarding$/);
  return email;
}

/** Экраны 1–3 (имя + логин + Москва + первый вуз), останавливается на «Ступени». */
async function walkPastUniversity(page: Page, username: string): Promise<void> {
  await page.locator("#onb-name").fill("Тестовый Пользователь");
  await onbNext(page);
  await page.locator("#onb-username").fill(username);
  await onbNext(page);
  await page.locator("#onb-city").fill("Москва");
  await onbPick(
    page,
    '.onb-combo-item:not(.onb-combo-item--muted):has-text("Москва")'
  );
  await onbPick(page, ".onb-option:not(.onb-option--dashed)");
  await onbNext(page);
}

test("после регистрации — редирект на /onboarding, приложение недоступно", async ({
  page,
}) => {
  await registerBare(page);
  await expect(page.locator(".onb-shell")).toBeVisible();
  await expect(page.locator(".onb-progress")).toHaveText("Шаг 1 из 8");
  await expect(page.locator("#onb-name")).toBeVisible();

  // Прямой заход на защищённый роут возвращает в мастер.
  await page.goto("/s/1");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("полный проход мастера → дашборд с периодами", async ({ page }) => {
  const email = await registerBare(page);
  await completeOnboardingFast(page, { count: 3 });

  await expect(page.locator(".profile-email")).toHaveText(email);
  // Онбординг пройден — /onboarding больше не держит.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/s\//);
});

test("имя обязательно, адрес профиля проверяет формат", async ({ page }) => {
  await registerBare(page);
  const next = page.locator(".onb-next");

  // Экран 1: без имени «Далее» недоступна.
  await expect(next).toBeDisabled();
  await page.locator("#onb-name").fill("Даша");
  await onbNext(page);

  // Экран 2: невалидный логин (подчёркивание/заглавные) не пускает дальше.
  await page.locator("#onb-username").fill("Bad_Handle");
  await expect(page.locator(".onb-error")).toContainText("латинск");
  await expect(next).toBeDisabled();

  await page.locator("#onb-username").fill(handle("ok"));
  await expect(next).toBeEnabled();
});

test("коллизия логина", async ({ page, browser }) => {
  const taken = handle("dup");

  // Первый аккаунт занимает логин.
  await registerBare(page);
  await completeOnboardingFast(page, { username: taken, count: 1 });

  // Второй аккаунт — в отдельном контексте (свой localStorage, иначе
  // общий токен PocketBase уводит /login на дашборд первого аккаунта).
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await registerBare(page2);
  await page2.locator("#onb-name").fill("Второй");
  await onbNext(page2);
  await page2.locator("#onb-username").fill(taken);
  await onbNext(page2);
  await expect(page2.locator(".onb-error")).toContainText("занят");
  await expect(page2.locator(".onb-progress")).toHaveText("Шаг 2 из 8");

  // Другой логин — проходит дальше.
  await page2.locator("#onb-username").fill(`${taken}-ok`);
  await onbNext(page2);
  await expect(page2.locator(".onb-progress")).toHaveText("Шаг 3 из 8");
  await ctx2.close();
});

test("эскейп «вуз не найден» → ручной ввод", async ({ page }) => {
  await registerBare(page);

  await page.locator("#onb-name").fill("Тест");
  await onbNext(page);
  await page.locator("#onb-username").fill(handle("esc"));
  await onbNext(page);

  await page.locator("#onb-city").fill("Москва");
  await onbPick(
    page,
    '.onb-combo-item:not(.onb-combo-item--muted):has-text("Москва")'
  );
  await onbPick(page, '.onb-option--dashed:has-text("Не нашёл")');
  await page.locator("#onb-uni-custom").fill("Мой частный вуз");
  await onbNext(page);

  await expect(page.locator(".onb-progress")).toHaveText("Шаг 4 из 8");
});

test("смена ступени пересчитывает диапазон курса", async ({ page }) => {
  await registerBare(page);
  await walkPastUniversity(page, handle("crs"));

  // Бакалавриат → 6 вариантов курса.
  await onbPick(page, '.onb-option:has-text("Бакалавриат")');
  await onbNext(page);
  await expect(page.locator(".onb-pill")).toHaveCount(6);

  // Назад → Магистратура → 2 варианта.
  await page.locator('.onb-linkbtn:has-text("Назад")').dispatchEvent("click");
  await onbPick(page, '.onb-option:has-text("Магистратура")');
  await onbNext(page);
  await expect(page.locator(".onb-pill")).toHaveCount(2);
});

test("периоды: переименование и удаление", async ({ page }) => {
  await registerBare(page);
  await walkPastUniversity(page, handle("per"));
  await onbPick(page, '.onb-option:has-text("Бакалавриат")');
  await onbNext(page);
  await onbPick(page, '.onb-pill:has-text("1")');
  await onbNext(page);
  await onbPick(page, '.onb-option:has-text("Семестры")');
  await onbNext(page);

  await page.locator("#onb-count").fill("4");
  await page.locator('.btn-primary:has-text("Создать")').dispatchEvent("click");
  await expect(page.locator(".onb-period-row")).toHaveCount(4);

  // Переименовать первый период.
  const first = page.locator(".onb-period-input").first();
  await first.fill("Вводный семестр");
  await first.blur();
  await expect(page.locator(".onb-period-input").first()).toHaveValue(
    "Вводный семестр"
  );

  // Удалить последний период.
  await page
    .locator(".onb-period-row")
    .last()
    .locator(".onb-period-del")
    .dispatchEvent("click");
  await expect(page.locator(".onb-period-row")).toHaveCount(3);
});

test("периоды: пересоздание набора не плодит дублей", async ({ page }) => {
  await registerBare(page);
  await walkPastUniversity(page, handle("recr"));
  await onbPick(page, '.onb-option:has-text("Бакалавриат")');
  await onbNext(page);
  await onbPick(page, '.onb-pill:has-text("1")');
  await onbNext(page);
  await onbPick(page, '.onb-option:has-text("Семестры")');
  await onbNext(page);

  await page.locator("#onb-count").fill("5");
  await page.locator('.btn-primary:has-text("Создать")').dispatchEvent("click");
  await expect(page.locator(".onb-period-row")).toHaveCount(5);

  // Пересоздать меньшим числом — с подтверждением.
  await page.locator("#onb-count").fill("2");
  await page.locator('.btn-primary:has-text("Создать")').dispatchEvent("click");
  await page
    .locator('.confirm-content .btn-primary:has-text("Пересоздать")')
    .dispatchEvent("click");
  await expect(page.locator(".onb-period-row")).toHaveCount(2);

  // Завершаем и проверяем, что в приложении ровно 2 периода.
  await onbNext(page); // шаг 8 — аватар
  await onbNext(page); // готово
  await page.waitForURL(/\/s\//);
  await page.goto("/s/2");
  await expect(page).toHaveURL(/\/s\/2$/);
  await page.goto("/s/3");
  await expect(page.locator(".error-banner, .empty")).toBeVisible();
});
