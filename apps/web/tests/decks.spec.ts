/**
 * ============================================
 *  tests/decks.spec.ts — модуль карточек (decks)
 * ============================================
 *
 * Seed-зависимый: проходит на свежей БД после `npm run seed` (демо-колода
 * «Сетчатка глаза» → /decks/retina-vision). Здесь используем глубокую ссылку
 * /decks/retina-vision (паттерн recording/_coldload): прямой page.goto
 * надёжнее кликов по плиткам в headed-Firefox.
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("деки: перелистывание колоды (flip + «Знаю»)", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/decks/retina-vision");
  await expect(page.locator(".flash-card-stage")).toBeVisible();

  // Первая карточка: вопрос на лицевой стороне.
  await expect(page.locator(".flash-face.front")).toContainText(
    "Как называется светочувствительный слой"
  );

  // Переворачиваем — появляется .is-flipped, на обороте ответ.
  // dispatchEvent вместо click: плеер анимируется framer-motion (flip, drag,
  // AnimatePresence), поэтому кнопки не «успокаиваются» для headed-Firefox и
  // штатный клик висит до таймаута. Тот же приём, что для микрофона и сайдбара.
  await page
    .getByRole("button", { name: "Показать ответ" })
    .dispatchEvent("click");
  await expect(page.locator(".flash-3d-inner.is-flipped")).toBeVisible();
  await expect(page.locator(".flash-face.back")).toContainText("Сетчатка (лат");

  // «Знаю» → следующая карточка (новая монтируется неперевёрнутой).
  await page.getByRole("button", { name: "Знаю" }).dispatchEvent("click");
  await expect(page.locator(".flash-face.front")).toContainText(
    "Какие фоторецепторы"
  );
  await expect(page.locator(".flash-3d-inner")).not.toHaveClass(/is-flipped/);
});

test("деки: у каждой карточки есть доступный грип для перетаскивания", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/decks/retina-vision/edit");

  const cards = page.locator(".deck-editor-card");
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  const count = await cards.count();
  expect(count).toBeGreaterThan(1);

  // Сигнификатор аффорданса draggable: по грипу-кнопке на карточку,
  // это доступный контрол с aria-label и его можно сфокусировать.
  const grips = page.locator(".deck-editor-card .deck-card-drag");
  await expect(grips).toHaveCount(count);
  const first = grips.first();
  await expect(first).toHaveAttribute("aria-label", /Перетащить карточку/);
  await first.focus();
  await expect(first).toBeFocused();

  // Сам жест перетаскивания проверяется вручную (headed-Firefox не пропускает
  // клавиатурный DnD @dnd-kit) — см. docs/EXPERIMENTS.md, EXP-065.
});

test("деки: клавиатура переворачивает и «Знаю» продвигает", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/decks/retina-vision");
  await expect(page.locator(".flash-card-stage")).toBeVisible();

  // Space переворачивает карточку.
  await page.locator(".flash-card-stage").dispatchEvent("click");
  await page.keyboard.press(" ");
  await expect(page.locator(".flash-3d-inner.is-flipped")).toBeVisible();

  // Стрелка вправо = «Знаю» → следующая карточка.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".flash-face.front")).toContainText(
    "Какие фоторецепторы"
  );
});
