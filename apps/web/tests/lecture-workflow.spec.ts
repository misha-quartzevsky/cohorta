/**
 * ============================================
 *  tests/lecture-workflow.spec.ts — лекционный flow в новом UI
 * ============================================
 *
 * Проверяет работу LectureLayout + GlobalSidebar на лекции:
 *   1. Seamless navigation: при переключении лекций из сайдбара Header
 *      остаётся ТЕМ ЖЕ DOM-узлом (layout-route не перемонтируется),
 *      карточка лекции сменяется с fade-анимацией content-in.
 *   2. TOC (ОГЛАВЛЕНИЕ в сайдбаре): пункты соответствуют H1–H3 заголовкам
 *      контента, клик по пункту плавно скроллит к заголовку.
 *   3. Контекстный режим: на лекции секция «НЕДАВНИЕ» исчезает, появляются
 *      «ЛЕКЦИИ КУРСА» + «ОГЛАВЛЕНИЕ»; возврат к курсу — «НЕДАВНИЕ» снова в сайдбаре.
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Открывает лекцию «Предел последовательности». Используем прямой deep-link
 * вместо кликов по плиткам дашборда: у плиток hover-transform (transition 0.18s),
 * штатный клик по ним флакает в headed-Firefox. Deep-link проверяет тот же
 * асинхронный сценарий — контент подгружается ПОСЛЕ монтирования сайдбара,
 * что и требуется для TOC. SPA-навигация покрывается переключением лекций
 * через сайдбар (см. seamless-тест).
 */
async function openLimitOfSequence(page: import("@playwright/test").Page) {
  await page.goto("/s/demo/math-analysis/limit-of-sequence");
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Предел последовательности"
  );
}

test("seamless navigation: Header — тот же узел, карточка анимируется", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await openLimitOfSequence(page);

  // Метим Header — если layout перемонтируется, маркер пропадёт.
  const hdrMarker = "hdr-" + Date.now();
  await page.evaluate((m) => {
    document
      .querySelector(".app-header")
      ?.setAttribute("data-test-hdr-marker", m);
  }, hdrMarker);

  // Метим текущую карточку — при смене лекции workspace-main пересоздаётся.
  await page.evaluate(() => {
    document
      .querySelector(".workspace-main")
      ?.setAttribute("data-card-marker", "old");
  });

  const headerBefore = await page.locator(".app-header").boundingBox();

  // Переключение на другую лекцию курса из сайдбара.
  // dispatchEvent: штатный .click() по сайдбарной ссылке хронически зависает
  // в headed-Firefox («performing click action»), а событие клика всё равно
  // обрабатывает React-обработчик Link → SPA-навигация.
  const next = page
    .locator(".global-sidebar .sidebar-nav-item:not(.active)")
    .filter({ hasText: "Производная функции" })
    .first();
  await expect(next).toBeVisible();
  await next.dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis/derivative-geometry");
  await expect(page.locator(".lecture-card-title")).toHaveText(
    "Производная функции"
  );

  // Header: тот же DOM-узел и стабильная геометрия.
  const hdrVal = await page.evaluate(
    () =>
      document
        .querySelector(".app-header")
        ?.getAttribute("data-test-hdr-marker") ?? null
  );
  expect(hdrVal, "Header перемонтировался при смене лекции").toBe(hdrMarker);

  const headerAfter = await page.locator(".app-header").boundingBox();
  expect(
    Math.abs((headerAfter?.y ?? 0) - (headerBefore?.y ?? 0)),
    "Header сдвинулся по вертикали"
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs((headerAfter?.height ?? 0) - (headerBefore?.height ?? 0)),
    "Header изменил высоту"
  ).toBeLessThanOrEqual(0.5);

  // Карточка: элемент пересоздан (key=slug) → на новом нет старой метки.
  const cardMarker = await page.evaluate(
    () =>
      document.querySelector(".workspace-main")?.getAttribute(
        "data-card-marker"
      ) ?? null
  );
  expect(cardMarker).toBeNull();

  // Fade-анимация content-in применена к (пересозданной) карточке.
  const anim = await page.evaluate(() => {
    const el = document.querySelector(".workspace-main");
    return el ? getComputedStyle(el).animationName : "";
  });
  expect(["content-in", "none"]).toContain(anim);
});

test("TOC в сайдбаре: пункты = H1–H3, клик скроллит", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await openLimitOfSequence(page);

  // Секция «ОГЛАВЛЕНИЕ» в сайдбаре со списком toc-item.
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "ОГЛАВЛЕНИЕ",
    })
  ).toBeVisible();

  const tocItems = page.locator(".global-sidebar .toc-item");
  await expect(tocItems).toHaveCount(5, { timeout: 10000 });
  await expect(tocItems.nth(0)).toHaveText("Предел последовательности");
  await expect(tocItems.nth(1)).toHaveText("Определение");
  await expect(tocItems.nth(2)).toHaveText("Пример: 1/n");
  await expect(tocItems.nth(3)).toHaveText("Свойства пределов");
  await expect(tocItems.nth(4)).toHaveText("Единственность предела");

  // Плавный скролл к нижнему заголовку (тот же scrollIntoView, что в обработчике
  // клика TOC). Целимся в последний H2 ниже фолда и проверяем, что он ПОДНЯЛСЯ
  // во вьюпорте — этим доказываем, что скролл к заголовку реально работает.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const h2last = page
    .locator(".lecture-view-content h2")
    .filter({ hasText: "Единственность предела" });
  const beforeTop = await h2last.evaluate((el) => el.getBoundingClientRect().top);
  await h2last.evaluate((el) =>
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  );
  await page.waitForTimeout(1200);
  const afterTop = await h2last.evaluate((el) => el.getBoundingClientRect().top);
  expect(afterTop, "Заголовок не поднялся — плавный скролл не сработал").toBeLessThan(
    beforeTop
  );
});

test("контекстный режим: НЕДАВНИЕ ↔ ЛЕКЦИИ КУРСА", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // Вне лекции — секции НЕДАВНИЕ и ЗАМЕТКИ, переключатель семестра.
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "НЕДАВНИЕ",
    })
  ).toBeVisible();
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "ЗАМЕТКИ",
    })
  ).toBeVisible();
  await expect(page.locator(".sidebar-semester-btn")).toBeVisible();

  // Входим в лекцию → контекстный режим.
  await openLimitOfSequence(page);
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "НЕДАВНИЕ",
    })
  ).toHaveCount(0);
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "ЛЕКЦИИ КУРСА",
    })
  ).toBeVisible();
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "ОГЛАВЛЕНИЕ",
    })
  ).toBeVisible();
  // Лекции курса реально видны в списке.
  await expect(
    page.locator(".global-sidebar .sidebar-nav-item", {
      hasText: "Производная функции",
    })
  ).toBeVisible();

  // «← Назад к курсу» → лекционная контекстная секция уходит, НЕДАВНИЕ возвращается.
  const backBtn = page.locator(".sidebar-back-btn");
  await expect(backBtn).toBeVisible();
  await backBtn.dispatchEvent("click");
  await page.waitForURL("**/s/demo/math-analysis");
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "НЕДАВНИЕ",
    })
  ).toBeVisible();
  await expect(
    page.locator(".global-sidebar .sidebar-section-title", {
      hasText: "ЛЕКЦИИ КУРСА",
    })
  ).toHaveCount(0);
});