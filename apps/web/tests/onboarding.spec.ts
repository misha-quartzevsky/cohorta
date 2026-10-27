/**
 * ============================================
 *  tests/onboarding.spec.ts — мастер онбординга
 * ============================================
 *
 * Новый аккаунт после регистрации попадает на /onboarding и не
 * видит приложения, пока не пройдёт мастер (4 шага). Проверяем:
 *  - полный проход → дашборд;
 *  - формат адреса профиля и коллизия логина (в /settings: в мастере адреса нет);
 *  - эскейп «вуз не найден»;
 *  - пересчёт диапазона курса при смене ступени;
 *  - переименование/удаление периода и уменьшение набора без дублей (/settings/periods).
 *
 * Клики по кнопкам мастера — через onbNext/onbChip (dispatchEvent):
 * обычный .click() завешивает headed-Firefox.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  completeOnboardingFast,
  expectAccountEmail,
  onbChip,
  onbNameAndUniversity,
  onbNext,
  registerBare,
  registerFresh,
} from "./helpers";

/** Валидный логин-поддомен из метки. */
const handle = (label: string) => `${label}-${Date.now().toString(36)}`;

/**
 * Шаги 1–2 (имя + Москва + первый вуз), останавливается на «Уровне и курсе».
 * Адреса профиля в мастере нет (решение Д1): логин меняется в /settings.
 */
async function walkPastUniversity(page: Page): Promise<void> {
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

/** /settings → строка «Имя пользователя» → «Изменить» (логин живёт в настройках, в мастере его нет). */
async function openHandleEditor(page: Page): Promise<void> {
  await page.goto("/settings");
  await page.locator(".c-erow", { hasText: "Имя пользователя" }).locator("button.act").click();
}

test("адрес профиля в настройках проверяет формат", async ({ page }) => {
  await registerFresh(page);
  await openHandleEditor(page);
  const field = page.getByLabel("Имя пользователя");
  const save = page.locator(".c-erow.editing").getByRole("button", { name: "Сохранить" });

  // Подчёркивание и заглавные не проходят, запись не уходит на сервер.
  await field.fill("Bad_Handle");
  await save.click();
  await expect(page.locator(".c-erow.editing")).toContainText("латинские буквы");

  await field.fill(handle("ok"));
  await save.click();
  await expect(page.locator(".c-erow", { hasText: "Имя пользователя" })).toContainText("Сохранено");
});

test("коллизия логина", async ({ page, browser }) => {
  const taken = handle("dup");

  // Первый аккаунт занимает логин.
  await registerFresh(page);
  await openHandleEditor(page);
  await page.getByLabel("Имя пользователя").fill(taken);
  await page.locator(".c-erow.editing").getByRole("button", { name: "Сохранить" }).click();
  await expect(page.locator(".c-erow", { hasText: "Имя пользователя" })).toContainText(`@${taken}`);

  // Второй аккаунт — в отдельном контексте (свой localStorage, иначе
  // общий токен PocketBase уводит /login на дашборд первого аккаунта).
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await registerFresh(page2);
  await openHandleEditor(page2);
  const save2 = page2.locator(".c-erow.editing").getByRole("button", { name: "Сохранить" });
  await page2.getByLabel("Имя пользователя").fill(taken);
  await save2.click();
  await expect(page2.locator(".c-erow.editing")).toContainText("занято");

  // Другой логин — сохраняется.
  await page2.getByLabel("Имя пользователя").fill(`${taken}-ok`);
  await save2.click();
  await expect(page2.locator(".c-erow", { hasText: "Имя пользователя" })).toContainText(`@${taken}-ok`);
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

/** Экран /settings/periods (десктоп): показаны первые 4 периода, «и ещё N периодов» раскрывает остальные. */
async function openPeriods(page: Page): Promise<void> {
  await page.goto("/settings/periods");
  await expect(page.locator(".c-period-row").first()).toBeVisible();
  const more = page.locator(".c-periods-more");
  if (await more.isVisible()) await more.click();
}

test("периоды: переименование и удаление", async ({ page }) => {
  await registerFresh(page);
  await openPeriods(page);
  // Бакалавриат, 1 курс, семестры: 8 периодов.
  await expect(page.locator(".c-period-row")).toHaveCount(8);

  // Переименовать первый период.
  await page.locator(".c-period-name").first().fill("Вводный семестр");

  // Удалить последний период.
  await page.locator(".c-period-row").last().locator("button.del").click();
  await expect(page.locator(".c-period-row")).toHaveCount(7);

  await page.locator(".c-periods-foot").getByRole("button", { name: "Сохранить" }).click();
  await expect(page.locator(".c-periods-saved")).toHaveText("Сохранено");

  // После перезагрузки изменения на месте.
  await page.reload();
  await openPeriods(page);
  await expect(page.locator(".c-period-row")).toHaveCount(7);
  await expect(page.locator(".c-period-name").first()).toHaveValue("Вводный семестр");
});

test("периоды: пересоздание набора не плодит дублей", async ({ page }) => {
  await registerFresh(page);
  await openPeriods(page);
  await expect(page.locator(".c-period-row")).toHaveCount(8);

  // Уменьшить число периодов до 2 (кнопка «−» у счётчика) и сохранить.
  const less = page.getByRole("button", { name: "Меньше" });
  for (let i = 0; i < 6; i += 1) await less.click();
  await expect(page.locator(".c-periods-count output")).toHaveText("2");
  await page.locator(".c-periods-foot").getByRole("button", { name: "Сохранить" }).click();
  await expect(page.locator(".c-periods-saved")).toHaveText("Сохранено");

  // В приложении ровно 2 периода: /s/2 есть, /s/3 нет.
  await page.goto("/s/2");
  await expect(page).toHaveURL(/\/s\/2$/);
  await page.goto("/s/3");
  await expect(page.locator(".error-banner, .empty, .c-empty")).toBeVisible();
});

test("имя обязательно: без имени «Далее» недоступна (шаг 1 нового мастера)", async ({ page }) => {
  await registerBare(page);
  const next = page.getByRole("button", { name: "Далее" });

  await expect(next).toBeDisabled();
  await page.getByLabel("Как тебя зовут").fill("Даша");
  await expect(next).toBeEnabled();
});
