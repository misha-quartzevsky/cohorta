/**
 * ============================================
 *  tests/group-mode.spec.ts — режим «Группа»: вход в режим
 * ============================================
 *
 * Здесь только переключатель режима и пустое состояние группы. Создание группы, вступление по ссылке, предпросмотр,
 * выдача и запрос доступа и коллективный экзамен проверяются на экранах волны C в `group-screens.spec.ts`.
 */

import { test, expect } from "@playwright/test";
import { registerFresh } from "./helpers";

test("по умолчанию Соло: в навигации нет пункта «Группа», переключатель на «Соло»", async ({ page }) => {
  await registerFresh(page, "grp");
  await expect(page.locator(".c-shell-nav a", { hasText: "Группа" })).toHaveCount(0);
  await expect(page.locator('.c-shell-mode [role="radio"][aria-checked="true"]')).toHaveText("Соло");
});

// Прямой заход на /group в режиме Соло: открытие адреса группы включает режим «Группа», а человеку без
// группы показывается пустое состояние «Вступи в свою группу» (Screen-group-join), без редиректа на дашборд.
test("Соло: прямой заход на /group открывает «Вступи в свою группу»", async ({ page }) => {
  await registerFresh(page, "grp");
  await page.goto("/s/1/group");
  await expect(page).toHaveURL(/\/s\/1\/group$/);
  await expect(page.getByRole("heading", { name: "Вступи в свою группу" })).toBeVisible();
  await expect(page.getByLabel("Код группы")).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать свою группу" })).toBeVisible();
  await expect(page.locator('.c-shell-mode [role="radio"][aria-checked="true"]')).toHaveText("Группа");
});
