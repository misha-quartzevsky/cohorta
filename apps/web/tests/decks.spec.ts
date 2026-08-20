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
  await page.getByRole("button", { name: "Показать ответ" }).click();
  await expect(page.locator(".flash-3d-inner.is-flipped")).toBeVisible();
  await expect(page.locator(".flash-face.back")).toContainText("Сетчатка (лат");

  // «Знаю» → следующая карточка (новая монтируется неперевёрнутой).
  await page.getByRole("button", { name: "Знаю" }).click();
  await expect(page.locator(".flash-face.front")).toContainText(
    "Какие фоторецепторы"
  );
  await expect(page.locator(".flash-3d-inner")).not.toHaveClass(/is-flipped/);
});

test("деки: клавиатура переворачивает и «Знаю» продвигает", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/decks/retina-vision");
  await expect(page.locator(".flash-card-stage")).toBeVisible();

  // Space переворачивает карточку.
  await page.locator(".flash-card-stage").click();
  await page.keyboard.press(" ");
  await expect(page.locator(".flash-3d-inner.is-flipped")).toBeVisible();

  // Стрелка вправо = «Знаю» → следующая карточка.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".flash-face.front")).toContainText(
    "Какие фоторецепторы"
  );
});
