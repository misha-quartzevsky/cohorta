/**
 * =============================================
 *  tests/_coldload.spec.ts — регрессия MathLive
 * =============================================
 * Гарантирует, что LaTeX‑формула отрисовывается в `<math-div.math-render`
 * в трёх сценариях:
 *   1. холодный deep-link на лекцию (первичная загрузка страницы);
 *   2. hard reload (перезагрузка браузера на лекции — когда раньше ломался dev SW);
 *   3. переключение «A → B → A» через список предмета (SPA‑навигация без reload).
 *
 * Съёмный dev-сервис-worker отключён в main.tsx (PROD only), поэтому
 * reload всегда идёт на чистый dev‑сервер.
 */

import { test, expect } from "@playwright/test";
import { login, openOtherLectureOfCourse } from "./helpers";

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
  await expect(page.locator(".lecture-title-input")).toHaveValue(
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
  await expect(page.locator(".lecture-title-input")).toHaveValue(
    "Предел последовательности"
  );
  await page.reload();
  await expect(page.locator(".lecture-title-input")).toHaveValue(
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
  await expect(page.locator(".lecture-title-input")).toHaveValue(
    "Предел последовательности"
  );
  // Переключаемся на другую лекцию курса и возвращаемся (SPA-навигация без reload).
  // Списка лекций курса в сайдбаре больше нет: идём через крошку «Предмет» и список.
  await openOtherLectureOfCourse(page, "Математический анализ", "Производная функции");
  await page.waitForURL((url) => !url.pathname.endsWith("limit-of-sequence"));
  await openOtherLectureOfCourse(page, "Математический анализ", "Предел последовательности");
  await page.waitForURL("**/limit-of-sequence");
  await expect(page.locator(".lecture-title-input")).toHaveValue(
    "Предел последовательности"
  );

  await expect
    .poll(
      async () => (await mathSize(page)).height,
      { timeout: 15000, intervals: [300, 600] }
    )
    .toBeGreaterThan(0);
});
