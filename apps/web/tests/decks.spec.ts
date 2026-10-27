/**
 * ============================================
 *  tests/decks.spec.ts — модуль карточек (decks)
 * ============================================
 *
 * Seed-зависимый: проходит на свежей БД после `npm run seed` (демо-колода
 * «Сетчатка глаза» → /decks/retina-vision). Здесь используем глубокие ссылки
 * /decks/retina-vision/review и /edit (паттерн recording/_coldload): прямой
 * page.goto надёжнее кликов по плиткам в headed-Firefox.
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("деки: повторение колоды (показать ответ + оценка «Хорошо»)", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/decks/retina-vision/review");
  await expect(page.locator(".c-review-card")).toBeVisible();

  // Первая карточка: вопрос; ответа и активных оценок ещё нет (Screen-cards-review).
  await expect(page.locator(".c-review-card .q")).toContainText("Как называется светочувствительный слой");
  await expect(page.locator(".c-review-card .a")).toHaveCount(0);
  await expect(page.locator(".c-review-rate")).toHaveClass(/off/);
  await expect(page.locator(".c-review-count")).toContainText("0 из");

  // «Показать ответ» → на карточке ответ, четыре оценки доступны.
  await page.getByRole("button", { name: "Показать ответ" }).click();
  await expect(page.locator(".c-review-card .a")).toContainText("Сетчатка (лат");
  for (const name of ["Снова", "Трудно", "Хорошо", "Легко"]) {
    await expect(page.locator(".c-review-rate").getByRole("button", { name, exact: true })).toBeEnabled();
  }

  // «Хорошо» → следующая карточка (ответ снова скрыт), счётчик вырос.
  await page.locator(".c-review-rate").getByRole("button", { name: "Хорошо", exact: true }).click();
  await expect(page.locator(".c-review-card .q")).toContainText("Какие фоторецепторы");
  await expect(page.locator(".c-review-card .a")).toHaveCount(0);
  await expect(page.locator(".c-review-count")).toContainText("1 из");
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

test("деки: клавиатура — пробел показывает ответ, «3» = «Хорошо» продвигает", async ({ page }) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/decks/retina-vision/review");
  await expect(page.locator(".c-review-card")).toBeVisible();

  // Цифры до ответа ничего не делают, пробел показывает ответ.
  await page.keyboard.press("3");
  await expect(page.locator(".c-review-card .q")).toContainText("Как называется светочувствительный слой");
  await page.keyboard.press(" ");
  await expect(page.locator(".c-review-card .a")).toBeVisible();

  // «3» — «Хорошо» (горячие клавиши 1–4 по порядку кнопок) → следующая карточка.
  await page.keyboard.press("3");
  await expect(page.locator(".c-review-card .q")).toContainText("Какие фоторецепторы");
});
