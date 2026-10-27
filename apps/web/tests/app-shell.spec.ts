/**
 * ============================================
 *  tests/app-shell.spec.ts — глобальный каркас (AppShellNew: .c-shell*)
 * ============================================
 *
 * Проверяет новый app-shell:
 *   1. Профиль пользователя виден в сайдбаре (имя + email); выход →
 *      редирект на /login.
 *   2. Период выбирается фильтром «Период» в «Все лекции» (отдельного
 *      переключателя семестра в сайдбаре нет): список открывается и закрывается.
 *   3. Смена периода — чистая SPA-навигация: контент меняется БЕЗ полной
 *      перезагрузки страницы (window сохраняется).
 */

import { test, expect, type Page } from "@playwright/test";
import { login, DEMO_EMAIL, expectAccountEmail } from "./helpers";

test("профиль в сайдбаре; выход → редирект на /login", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // App shell + профиль.
  await expect(page.locator(".c-shell-sidebar")).toBeVisible();
  await expect(page.locator(".c-shell-main")).toBeVisible();
  await expect(page.locator(".c-shell-profile .name")).toBeVisible();
  // Email показан в «Профиле и настройках» (блок профиля в сайдбаре ведёт туда).
  await expectAccountEmail(page, DEMO_EMAIL);

  // Выход (строка «Аккаунт · Выйти» в настройках) → защищённый layout уходит, мы на /login.
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL("**/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator(".c-shell-sidebar")).toHaveCount(0);
});

/** «Все лекции» → кнопка «Период» (Screen-lectures-period): отдельного переключателя семестра в сайдбаре нет (Д3). */
async function openPeriodList(page: Page) {
  await page.locator(".c-lec-period.wide").click();
  const list = page.locator(".c-lec-period-list");
  await expect(list).toBeVisible();
  return list;
}

test("фильтр «Период» в «Все лекции»: список открывается под кнопкой", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/s/demo/lectures");

  const btn = page.locator(".c-lec-period.wide");
  await expect(btn).toBeVisible();
  const list = await openPeriodList(page);

  // Выбран и помечен «текущий» период; кроме него есть другие и «Все периоды».
  await expect(list.locator('[role="option"][aria-selected="true"]')).toContainText("текущий");
  expect(await list.locator('[role="option"]').count()).toBeGreaterThan(2);
  await expect(list.getByRole("option", { name: "Все периоды" })).toBeVisible();

  // Список не раздувает сайдбар и не даёт горизонтальной прокрутки страницы.
  const noHOverflow = await page.evaluate(() => {
    const sb = document.querySelector(".c-shell-sidebar") as HTMLElement;
    return sb.scrollWidth <= sb.clientWidth && document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(noHOverflow).toBe(true);

  // Клик мимо списка и Escape закрывают его.
  await page.locator(".c-shell-main h1, .c-shell-main").first().click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".c-lec-period-list")).toHaveCount(0);
  await openPeriodList(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".c-lec-period-list")).toHaveCount(0);
});

test("роут /notes рендерится без краша сайдбара (current=null)", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // /notes — маршрут без семестра в URL → current=null. Раньше сборка ссылок
  // «НЕДАВНИЕ» вызывала semesterSlug(current!) с null → белый экран.
  await page.goto("/notes");
  await page.waitForURL("**/notes");

  // Сайдбар жив (без error boundary при не-загруженных семестрах).
  await expect(page.locator(".c-shell-sidebar")).toBeVisible();
  await expect(
    page.locator(".c-shell-nav a", { hasText: "Карточки" })
  ).toBeVisible();

  // Ни одна ссылка основной навигации не должна остаться без href (сборка пути не падает).
  const badHrefs = await page.locator(".c-shell-nav a").evaluateAll((els) =>
    els.filter((el) => !el.getAttribute("href")).length
  );
  expect(badHrefs).toBe(0);
});

test("смена периода в «Все лекции» = SPA (контент меняется, без reload)", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/s/demo/lectures");
  await expect(page.locator(".c-lec-row").first()).toBeVisible();

  // Метка на window. Если при смене периода произойдёт полный reload,
  // window пересоздастся и метка пропадёт.
  const marker = "spa-" + Date.now();
  await page.evaluate((m) => {
    (window as unknown as Record<string, unknown>).__spaNavMarker = m;
  }, marker);

  const btn = page.locator(".c-lec-period.wide");
  await expect(btn).toContainText("Демо-семестр");
  const list = await openPeriodList(page);
  await list.getByRole("option", { name: "Все периоды" }).click();

  await expect(btn).toContainText("Все периоды");
  await expect(page).toHaveURL(/\/s\/demo\/lectures$/);
  await expect(page.locator(".c-lec-row").first()).toBeVisible();

  // SPA: тот же window, что и до клика (никакого hard reload).
  await page.waitForFunction(
    (m) => (window as unknown as Record<string, unknown>).__spaNavMarker === m,
    marker
  );
});
