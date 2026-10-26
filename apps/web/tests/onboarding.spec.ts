/**
 * ============================================
 *  tests/onboarding.spec.ts — мастер онбординга
 * ============================================
 *
 * Новый аккаунт после регистрации попадает на /onboarding и не
 * видит приложения, пока не пройдёт мастер (4 шага). Проверяем:
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
  completeOnboardingFast,
  expectAccountEmail,
  onbChip,
  onbNameAndUniversity,
  onbNext,
  onbPick,
  registerBare,
} from "./helpers";

/** Валидный логин-поддомен из метки. */
const handle = (label: string) => `${label}-${Date.now().toString(36)}`;

/**
 * Шаги 1–2 (имя + Москва + первый вуз), останавливается на «Уровне и курсе».
 * Параметр username остался от прежнего мастера (шаг «Адрес профиля»): в новом
 * мастере логина нет, значение игнорируется, тесты на логин ждут решения.
 */
async function walkPastUniversity(page: Page, _username?: string): Promise<void> {
  await onbNameAndUniversity(page, "Тестовый Пользователь");
}

test("после регистрации — редирект на /onboarding, приложение недоступно", async ({
  page,
}) => {
  await registerBare(page);
  await expect(page.locator(".c-onb")).toBeVisible();
  await expect(page.locator(".c-onb-step")).toHaveText("Шаг 1 из 4");
  await expect(page.getByLabel("Как тебя зовут")).toBeVisible();

  // Прямой заход на защищённый роут возвращает в мастер.
  await page.goto("/s/1");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("полный проход мастера → дашборд с периодами", async ({ page }) => {
  const email = await registerBare(page);
  await completeOnboardingFast(page);

  await expectAccountEmail(page, email);
  // Онбординг пройден — /onboarding больше не держит.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/s\//);
  // Бакалавриат, 1 курс, семестры: 8 периодов (прежде число задавалось вручную).
  await page.goto("/s/8");
  await expect(page).toHaveURL(/\/s\/8$/);
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

  await page.getByLabel("Как тебя зовут").fill("Тест");
  await onbNext(page);

  await page.getByLabel("Город").fill("Москва");
  const city = page.locator(".c-onb-sugg button", { hasText: "Москва" }).first();
  await city.waitFor({ state: "visible" });
  await city.dispatchEvent("click");
  await page.locator(".c-onb-unis .manual").dispatchEvent("click");
  await page.getByPlaceholder("Название вуза").fill("Мой частный вуз");
  await onbNext(page);

  await expect(page.locator(".c-onb-step")).toHaveText("Шаг 3 из 4");
});

test("смена ступени пересчитывает диапазон курса", async ({ page }) => {
  await registerBare(page);
  await walkPastUniversity(page);

  // Бакалавриат → 6 вариантов курса (уровень и курс теперь на одном шаге).
  await onbChip(page, "Бакалавриат");
  await expect(page.locator(".c-onb-round")).toHaveCount(6);

  // Магистратура → 2 варианта.
  await onbChip(page, "Магистратура");
  await expect(page.locator(".c-onb-round")).toHaveCount(2);
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

test("имя обязательно: без имени «Далее» недоступна (шаг 1 нового мастера)", async ({ page }) => {
  await registerBare(page);
  const next = page.getByRole("button", { name: "Далее" });

  await expect(next).toBeDisabled();
  await page.getByLabel("Как тебя зовут").fill("Даша");
  await expect(next).toBeEnabled();
});
