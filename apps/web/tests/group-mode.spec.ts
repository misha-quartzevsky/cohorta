/**
 * ============================================
 *  tests/group-mode.spec.ts — режим «Группа», этап A
 * ============================================
 *
 * Проверяемый вертикальный срез этапа A:
 *  1. По умолчанию — Соло: пункта «Группа» нет, /s/:sem/group редиректит.
 *  2. Переключатель Соло/Группа под логотипом включает режим и ведёт на экран.
 *  3. Создание группы (с обязательным fuzzy-поиском) → карточка + ростер(1).
 *  4. Fuzzy-поиск против фрагментации: совпадение по названию →
 *     «Присоединиться к «…»», кнопка создания → «Всё равно создать новую».
 *  5. Второй пользователь вступает по коду → ростер(2).
 *
 * Превью конспектов и точечный шеринг — этап B (в этом спеке не проверяются).
 */

import { test, expect, type Page } from "@playwright/test";
import { LAST_SEMESTER_KEY } from "./helpers";

/** Регистрирует нового пользователя и оставляет его залогиненным на /s/1. */
async function registerFresh(page: Page): Promise<string> {
  const email = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "1" }
  );
  await page.goto("/login");
  await page.locator(".login-switch").dispatchEvent("click");
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill("test12345");
  await pw.nth(1).fill("test12345");
  await pw.nth(1).press("Enter");
  await page.waitForURL(/\/s\//);
  return email;
}

async function switchToGroup(page: Page): Promise<void> {
  await page
    .locator(".mode-toggle-btn", { hasText: "Группа" })
    .dispatchEvent("click");
  await page.waitForURL(/\/s\/[^/]+\/group$/);
}

test("по умолчанию Соло: нет пункта «Группа», /group редиректит", async ({
  page,
}) => {
  await registerFresh(page);
  await expect(
    page.locator(".sidebar-nav-item", { hasText: "Группа" })
  ).toHaveCount(0);

  await page.goto("/s/1/group");
  await expect(page).toHaveURL(/\/s\/1$/);
});

test("переключатель включает режим, создание группы даёт карточку и ростер", async ({
  page,
}) => {
  await registerFresh(page);
  await switchToGroup(page);

  await expect(
    page.locator(".sidebar-nav-item", { hasText: "Группа" })
  ).toBeVisible();
  await expect(page.locator(".page-title")).toHaveText("Моя группа");

  const name = `E2E Поток ${Date.now()}`;
  await page.locator("#group-name-input").fill(name);
  // Кнопка создания недоступна, пока fuzzy-поиск не отработал.
  const createBtn = page.locator(".group-primary-btn", { hasText: "Создать группу" });
  await expect(createBtn).toBeVisible({ timeout: 5000 });
  await createBtn.click();

  const card = page.locator(".group-card", { hasText: name });
  await expect(card).toBeVisible();
  await expect(card.locator(".group-badge")).toHaveText("Вы владелец");
  await expect(card.locator(".group-roster-item")).toHaveCount(1);
  await expect(card.locator(".group-invite-code")).toContainText("/login?invite=");
});

test("fuzzy-поиск: совпадение по названию предлагает присоединиться, создание уходит на второй план", async ({
  browser,
}) => {
  const ts = Date.now();
  const groupName = `Медиапоток МК ${ts}`;

  // Пользователь A создаёт группу.
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await registerFresh(pageA);
  await switchToGroup(pageA);
  await pageA.locator("#group-name-input").fill(groupName);
  await pageA
    .locator(".group-primary-btn", { hasText: "Создать группу" })
    .click();
  await expect(pageA.locator(".group-card", { hasText: groupName })).toBeVisible();
  const inviteText = await pageA
    .locator(".group-card", { hasText: groupName })
    .locator(".group-invite-code")
    .textContent();
  const code = (inviteText ?? "").split("invite=")[1]?.trim() ?? "";
  expect(code.length).toBeGreaterThan(3);

  // Пользователь B вводит почти то же название → должен увидеть кандидата.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await registerFresh(pageB);
  await switchToGroup(pageB);
  await pageB.locator("#group-name-input").fill(`Медиапоток МК-${ts}`);

  const candidate = pageB.locator(".group-candidate", { hasText: groupName });
  await expect(candidate).toBeVisible({ timeout: 5000 });
  await expect(
    pageB.locator(".group-create-anyway", { hasText: "Всё равно создать новую" })
  ).toBeVisible();

  // B вступает по коду приглашения → ростер группы становится 2.
  await pageB.locator("#group-invite-input").fill(code);
  await pageB.locator(".group-primary-btn", { hasText: "Присоединиться" }).click();

  const cardB = pageB.locator(".group-card", { hasText: groupName });
  await expect(cardB).toBeVisible();
  await expect(cardB.locator(".group-roster-item")).toHaveCount(2);

  await ctxA.close();
  await ctxB.close();
});
