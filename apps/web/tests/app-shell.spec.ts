/**
 * ============================================
 *  tests/app-shell.spec.ts — глобальный каркас (AppLayout/GlobalSidebar)
 * ============================================
 *
 * Проверяет новый app-shell:
 *   1. Профиль пользователя виден в сайдбаре (имя + email); выход →
 *      редирект на /login.
 *   2. Переключатель семестров живёт в сайдбаре: попап открывается.
 *   3. Смена семестра — чистая SPA-навигация: URL и контент меняются
 *      БЕЗ полной перезагрузки страницы (window сохраняется).
 */

import { test, expect } from "@playwright/test";
import { login, DEMO_EMAIL } from "./helpers";

test("профиль в сайдбаре; выход → редирект на /login", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // App shell + профиль.
  await expect(page.locator(".global-sidebar")).toBeVisible();
  await expect(page.locator(".app-main")).toBeVisible();
  await expect(page.locator(".profile-name")).toBeVisible();
  await expect(page.locator(".profile-email")).toHaveText(DEMO_EMAIL);

  // Выход → защищённый layout уходит, мы на /login.
  await page.locator(".profile-logout").click();
  await page.waitForURL("**/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator(".global-sidebar")).toHaveCount(0);
});

test("переключатель семестров: попап открывается из сайдбара", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  const btn = page.locator(".sidebar-semester-btn");
  await expect(btn).toBeVisible();
  await expect(btn).toContainText("demo семестр");

  // dispatchEvent обходит headed-Firefox click-stability флак (элемент в
  // сайдбаре не «успокаивается» из-за hover/content-in анимаций).
  await btn.dispatchEvent("click");
  await expect(page.locator(".sidebar-semester-popup")).toBeVisible();
  // Активный семестр помечен, остальных несколько (1..12 + demo).
  await expect(page.locator(".sidebar-semester-item.active")).toContainText(
    "demo семестр"
  );
  const count = await page.locator(".sidebar-semester-item").count();
  expect(count).toBeGreaterThan(1);

  // Попап — настоящий fixed-overlay на left:240px (поверх контента), а НЕ
  // in-flow элемент, расширяющий сайдбар и добавляющий горизонтальный скролл.
  const popupStyle = await page
    .locator(".sidebar-semester-popup")
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, left: cs.left };
    });
  expect(popupStyle.position).toBe("fixed");
  expect(popupStyle.left).toBe("240px");
  const noHOverflow = await page.evaluate(() => {
    const sb = document.querySelector(".global-sidebar") as HTMLElement;
    return sb.scrollWidth <= sb.clientWidth;
  });
  expect(noHOverflow).toBe(true);

  // Клик по фону закрывает попап.
  await page.locator(".sidebar-semester-backdrop").dispatchEvent("click");
  await expect(page.locator(".sidebar-semester-popup")).toHaveCount(0);
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
  await expect(page.locator(".global-sidebar")).toBeVisible();
  await expect(
    page.locator(".sidebar-section-title", { hasText: "НЕДАВНИЕ" })
  ).toBeVisible();

  // Ни одна ссылка НЕДАВНИЕ не должна остаться без href (сборка пути не падает).
  const badHrefs = await page.locator(".sidebar-nav-item").evaluateAll((els) =>
    els.filter((el) => !el.getAttribute("href")).length
  );
  expect(badHrefs).toBe(0);
});

test("смена семестра через сайдбар = SPA (URL и контент, без reload)", async ({
  page,
}) => {

  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await expect(page.locator(".page-title")).toContainText("Семестр demo");

  // Метка на window. Если при смене семестра произойдёт полный reload,
  // window пересоздастся и метка пропадёт → waitForFunction не дождётся.
  const marker = "spa-" + Date.now();
  await page.evaluate((m) => {
    (window as unknown as Record<string, unknown>).__spaNavMarker = m;
  }, marker);

  await page.locator(".sidebar-semester-btn").dispatchEvent("click");
  await page
    .locator(".sidebar-semester-item", { hasText: "1 семестр" })
    .first()
    .click();

  await page.waitForURL("**/s/1");
  await expect(page.locator(".page-title")).toContainText("Семестр 1");

  // SPA: тот же window, что и до клика (никакого hard reload).
  await page.waitForFunction(
    (m) => (window as unknown as Record<string, unknown>).__spaNavMarker === m,
    marker
  );
});
