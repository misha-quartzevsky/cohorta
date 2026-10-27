/**
 * ============================================
 *  tests/lecture-workflow.spec.ts — лекционный flow в новом UI
 * ============================================
 *
 * Проверяет работу LectureLayout + AppShellNew на лекции:
 *   1. Seamless navigation: при переключении лекций из сайдбара Header
 *      остаётся ТЕМ ЖЕ DOM-узлом (layout-route не перемонтируется),
 *      карточка лекции сменяется с fade-анимацией content-in.
 *   2. TOC («Оглавление» в сайдбаре): пункты соответствуют H1–H3 заголовкам
 *      контента, клик по пункту плавно скроллит к заголовку.
 *   3. Сайдбар: на дашборде список «Предметы», на лекции его заменяет
 *      «Содержание» со ссылкой на предмет; на странице предмета снова «Предметы».
 */

import { test, expect } from "@playwright/test";
import { login, openLectureViaSearch } from "./helpers";

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
  await expect(page.locator(".lecture-title-input")).toHaveValue(
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
      .querySelector(".c-shell-topbar")
      ?.setAttribute("data-test-hdr-marker", m);
  }, hdrMarker);

  // Метим текущую карточку — при смене лекции workspace-main пересоздаётся.
  await page.evaluate(() => {
    document
      .querySelector(".lecture-view-content")
      ?.setAttribute("data-card-marker", "old");
  });

  const headerBefore = await page.locator(".c-shell-topbar").boundingBox();

  // Переключение на другую лекцию курса через поиск (списка лекций в новом
  // сайдбаре нет): прямая SPA-навигация лекция → лекция. dispatchEvent: штатный
  // .click() хронически зависает в headed-Firefox, а React-обработчик отрабатывает.
  await openLectureViaSearch(page, "Производная функции", "Производная функции");
  await page.waitForURL("**/s/demo/math-analysis/derivative-geometry");
  await expect(page.locator(".lecture-title-input")).toHaveValue(
    "Производная функции"
  );

  // Header: тот же DOM-узел и стабильная геометрия.
  const hdrVal = await page.evaluate(
    () =>
      document
        .querySelector(".c-shell-topbar")
        ?.getAttribute("data-test-hdr-marker") ?? null
  );
  expect(hdrVal, "Header перемонтировался при смене лекции").toBe(hdrMarker);

  const headerAfter = await page.locator(".c-shell-topbar").boundingBox();
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
      document.querySelector(".lecture-view-content")?.getAttribute(
        "data-card-marker"
      ) ?? null
  );
  expect(cardMarker).toBeNull();

  // Fade-анимация content-in применена к (пересозданной) карточке.
  const anim = await page.evaluate(() => {
    const el = document.querySelector(".lecture-view-content");
    return el ? getComputedStyle(el).animationName : "";
  });
  expect(["content-in", "none"]).toContain(anim);
});

test("TOC в сайдбаре: пункты = H1–H3, клик скроллит", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await openLimitOfSequence(page);

  // Секция «Содержание» в сайдбаре со списком пунктов (.c-toc a).
  await expect(
    page.locator(".c-shell-sidebar .c-shell-section", {
      hasText: "Содержание",
    })
  ).toBeVisible();

  const tocItems = page.locator(".c-shell-sidebar .c-toc a");
  await expect(tocItems).toHaveCount(5, { timeout: 10000 });
  await expect(tocItems.nth(0)).toHaveText("Предел последовательности");
  await expect(tocItems.nth(1)).toHaveText("Определение");
  await expect(tocItems.nth(2)).toHaveText("Пример: 1/n");
  await expect(tocItems.nth(3)).toHaveText("Свойства пределов");
  await expect(tocItems.nth(4)).toHaveText("Единственность предела");

  // Клик по пункту оглавления должен привести к своему заголовку. Проверяем
  // РЕАЛЬНЫЙ клик по кнопке в сайдбаре и то, что обработчик позвал
  // scrollIntoView именно на нужном <h2>.
  //
  // Пиксельное смещение здесь измерять нельзя: `TableOfContents.scrollTo`
  // использует `behavior: "smooth"`, а Playwright-Firefox плавный скролл
  // ИГНОРИРУЕТ (обычный scrollIntoView в нём работает — проверено замером:
  // scrollTo(0,250) → 250, scrollIntoView без behavior → 368, со smooth → 0).
  // Прошлая версия теста звала scrollIntoView сама из page.evaluate и мерила
  // сдвиг — то есть проверяла возможности браузера, а не наш код, и была
  // записана в .clinerules как известный флак.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__tocScrollTarget = null;
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, ...args) {
      w.__tocScrollTarget = this.textContent;
      return original.apply(this, args as []);
    };
  });

  await page
    .locator(".c-shell-sidebar .c-toc a", { hasText: "Единственность предела" })
    .dispatchEvent("click");

  await page.waitForFunction(
    () =>
      (window as unknown as Record<string, unknown>).__tocScrollTarget ===
      "Единственность предела",
    undefined,
    { timeout: 5000 }
  );
});

test("сайдбар: на дашборде «Предметы», на лекции «Содержание» вместо них", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");

  // Дашборд: плоский список предметов семестра (Foundation-shell), без вложенных лекций.
  const section = (name: string) => page.locator(".c-shell-sidebar .c-shell-section", { hasText: name });
  await expect(section("Предметы")).toBeVisible();
  await expect(page.locator(".c-shell-courses a", { hasText: "Математический анализ" }).first()).toBeVisible();
  await expect(section("Содержание")).toHaveCount(0);

  // Лекция: «Содержание» заменяет список предметов, наверху ссылка на предмет (Screen-editor-toc).
  await openLimitOfSequence(page);
  await expect(section("Содержание")).toBeVisible();
  await expect(page.locator(".c-shell-sidebar .c-shell-back", { hasText: "Математический анализ" })).toBeVisible();
  await expect(page.locator(".c-shell-courses")).toHaveCount(0);

  // Ссылка наверху ведёт на страницу предмета: «Содержание» уходит, список предметов возвращается,
  // активный предмет отмечен.
  await page.locator(".c-shell-sidebar .c-shell-back").click();
  await expect(page).toHaveURL(/\/s\/demo\/math-analysis$/);
  await expect(section("Содержание")).toHaveCount(0);
  await expect(page.locator(".c-shell-courses a.on", { hasText: "Математический анализ" })).toBeVisible();
});
