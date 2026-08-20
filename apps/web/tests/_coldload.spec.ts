/**
 * =============================================
 *  tests/_coldload.spec.ts — регрессия MathLive
 * =============================================
 * Гарантирует, что LaTeX‑формула отрисовывается в `<math-div.math-render`
 * в трёх сценариях:
 *   1. холодный deep-link на лекцию (первичная загрузка страницы);
 *   2. hard reload (перезагрузка браузера на лекции — когда раньше ломался dev SW);
 *   3. переключение «A → B → A» из сайдбара (SPA‑навигация без reload).
 *
 * Съёмный dev-сервис-worker отключён в main.tsx (PROD only), поэтому
 * reload всегда идёт на чистый dev‑сервер.
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const LECTURE = "/s/demo/math-analysis/limit-of-sequence";

async function mathSize(page: import("@playwright/test").Page) {
  const math = page.locator(".lecture-view-content math-div.math-render").first();
  const box = await math.boundingBox();
  return { found: !!box, width: box?.width ?? 0, height: box?.height ?? 0 };
}

test("холодный deep-link → формула с контентом", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto(LECTURE);
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );
  await expect(
    page.locator(".lecture-view-content [data-type='math-block']").first()
  ).toBeVisible();

  await expect
    .poll(
      async () => (await mathSize(page)).height,
      { timeout: 10000, intervals: [200, 400] }
    )
    .toBeGreaterThan(0);
});

test("hard reload на лекции → формула с контентом", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto(LECTURE);
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );
  await page.reload();
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );
  await expect(
    page.locator(".lecture-view-content [data-type='math-block']").first()
  ).toBeVisible();

  await expect
    .poll(
      async () => (await mathSize(page)).height,
      { timeout: 10000, intervals: [200, 400] }
    )
    .toBeGreaterThan(0);
});

test("переключение туда-обратно рендерит формулу", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto(LECTURE);
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );
  // Переключаемся на другую лекцию из сайдбара и возвращаемся. Целимся явно
  // в лекцию курса (не в «Рабочий стол» из группы ОСНОВНОЕ, который теперь
  // первый `.sidebar-nav-item` в сайдбаре на лекции).
  const other = page
    .locator(".global-sidebar .sidebar-nav-item:not(.active)")
    .filter({ hasText: "Производная функции" })
    .first();
  await expect(other).toBeVisible();
  await other.click();
  await page.waitForURL((url) => !url.pathname.endsWith("limit-of-sequence"));
  await page
    .locator(".global-sidebar .sidebar-nav-item", {
      hasText: "Предел последовательности",
    })
    .click();
  await page.waitForURL("**/limit-of-sequence");
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );

  await expect
    .poll(
      async () => (await mathSize(page)).height,
      { timeout: 15000, intervals: [300, 600] }
    )
    .toBeGreaterThan(0);
});
