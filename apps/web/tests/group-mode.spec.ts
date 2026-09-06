/**
 * ============================================
 *  tests/group-mode.spec.ts — режим «Группа», этапы A / B / C
 * ============================================
 *
 * Этап A: Соло по умолчанию; переключатель + создание группы;
 *   обязательный fuzzy-поиск против фрагментации; вступление по коду.
 * Этап B: «показать группе» + preview_enabled → участник видит
 *   thumbnail чужой лекции, но НЕ полный контент.
 * Этап C ч.1: диалог «Доступ» — точечная выдача полного доступа
 *   и индивидуальный отзыв (B теряет, C сохраняет).
 * Этап C ч.2: коллективная подготовка экзамена — виджет «Участники»
 *   после переключения экзамена в режим group.
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
  const email = await registerFresh(page);
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
  // Фолбэк имени участника без user.name → часть email до «@» (не сырой id,
  // не пусто, не «Пользователь»). См. memberDisplayName() в lib/format.ts.
  await expect(card.locator(".group-roster-name")).toHaveText(
    email.split("@")[0]
  );
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

/**
 * Создаёт заметку с заголовком (тело не набираем — TipTap-ввод в
 * headed-Firefox флакает; для проверок доступа хватает заголовка).
 * Возвращает slug.
 */
async function createNote(page: Page, title: string): Promise<string> {
  await page.goto("/note/new");
  const titleInput = page.locator(".lecture-title-input");
  await titleInput.click();
  await titleInput.pressSequentially(title, { delay: 15 });
  await expect(titleInput).toHaveValue(title);
  const save = page.locator(".btn-primary", { hasText: "Сохранить заметку" });
  await expect(save).toBeEnabled();
  // dispatchEvent — обход headed-Firefox «element is not stable» (правило проекта).
  await save.dispatchEvent("click");
  await page.waitForURL(/\/note\/(?!new$)[^/]+$/);
  const m = page.url().match(/\/note\/([^/?#]+)/);
  return m ? m[1] : "";
}

test("этап B: участник видит thumbnail чужой лекции, но не её содержимое", async ({
  browser,
}) => {
  const ts = Date.now();
  const groupName = `B-Поток ${ts}`;
  const noteTitle = `Секрет ${ts}`;

  // A: группа + заметка + «показать группе» + preview_enabled
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  const emailA = await registerFresh(pageA);
  await switchToGroup(pageA);
  await pageA.locator("#group-name-input").fill(groupName);
  await pageA.locator(".group-primary-btn", { hasText: "Создать группу" }).click();
  await expect(pageA.locator(".group-card", { hasText: groupName })).toBeVisible();
  const inviteText = await pageA
    .locator(".group-card", { hasText: groupName })
    .locator(".group-invite-code")
    .textContent();
  const code = (inviteText ?? "").split("invite=")[1]?.trim() ?? "";

  const slug = await createNote(pageA, noteTitle);
  expect(slug.length).toBeGreaterThan(0);

  // «Показать группе» на странице заметки
  await pageA.locator(".share-group .icon-btn").click();
  await pageA
    .locator(".share-group-menu-item", { hasText: groupName })
    .click();
  await expect(pageA.locator(".share-group-chip")).toBeVisible();

  // включаем preview_enabled на экране группы
  await pageA.goto("/s/1/group");
  // дождаться, пога ростер подгрузится (иначе клик по чекбоксу до refetch)
  await expect(pageA.locator(".group-roster-item").first()).toBeVisible();
  const previewCb = pageA.locator(".group-preview-toggle input");
  await previewCb.click();
  // тумблер контролируемый + backing-состояние обновляется после refetch —
  // ждём фактического переключения, а не синхронной реакции .check().
  await expect(previewCb).toBeChecked({ timeout: 8000 });

  // B: вступает по коду, открывает ростер-строку A
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await registerFresh(pageB);
  await switchToGroup(pageB);
  await pageB.locator("#group-invite-input").fill(code);
  await pageB.locator(".group-primary-btn", { hasText: "Присоединиться" }).click();
  await expect(pageB.locator(".group-card", { hasText: groupName })).toBeVisible();

  const rowA = pageB
    .locator(".group-roster-item")
    .filter({ hasText: emailA });
  await rowA.click();

  // thumbnail виден: заголовок чужой лекции
  const preview = pageB.locator(".group-preview-item", { hasText: noteTitle });
  await expect(preview).toBeVisible({ timeout: 6000 });

  // но полный контент — недоступен (страница уходит в ошибку/пустоту)
  await pageB.goto(`/note/${slug}`);
  await expect(pageB.locator(".error-banner, .empty")).toBeVisible({
    timeout: 15000,
  });

  await ctxA.close();
  await ctxB.close();
});

test("этап C: точечная выдача и индивидуальный отзыв доступа к лекции", async ({
  browser,
}) => {
  const ts = Date.now();
  const groupName = `C-Поток ${ts}`;
  const noteTitle = `Доступ ${ts}`;
  // «полный доступ» = отрисовалась НАСТОЯЩАЯ карточка лекции (не
  // skeleton `[aria-busy]`, у которого тот же класс `.lecture-card`).
  const hasFullAccess = (page: Page) =>
    expect(
      page.locator('.lecture-card:not([aria-busy="true"]) .lecture-title-input')
    ).toBeVisible({ timeout: 15000 });
  // «нет доступа» = страница дошла до состояния ошибки/пустоты.
  const noAccess = (page: Page) =>
    expect(page.locator(".error-banner, .empty")).toBeVisible({
      timeout: 15000,
    });

  // A: группа + заметка
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await registerFresh(pageA);
  await switchToGroup(pageA);
  await pageA.locator("#group-name-input").fill(groupName);
  await pageA.locator(".group-primary-btn", { hasText: "Создать группу" }).click();
  await expect(pageA.locator(".group-card", { hasText: groupName })).toBeVisible();
  const inviteText = await pageA
    .locator(".group-card", { hasText: groupName })
    .locator(".group-invite-code")
    .textContent();
  const code = (inviteText ?? "").split("invite=")[1]?.trim() ?? "";
  const slug = await createNote(pageA, noteTitle);

  // B и C вступают
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  const emailB = await registerFresh(pageB);
  await switchToGroup(pageB);
  await pageB.locator("#group-invite-input").fill(code);
  await pageB.locator(".group-primary-btn", { hasText: "Присоединиться" }).click();
  await expect(pageB.locator(".group-card", { hasText: groupName })).toBeVisible();

  const ctxC = await browser.newContext();
  const pageC = await ctxC.newPage();
  const emailC = await registerFresh(pageC);
  await switchToGroup(pageC);
  await pageC.locator("#group-invite-input").fill(code);
  await pageC.locator(".group-primary-btn", { hasText: "Присоединиться" }).click();
  await expect(pageC.locator(".group-card", { hasText: groupName })).toBeVisible();

  // до выдачи: B не видит запись
  await pageB.goto(`/note/${slug}`);
  await noAccess(pageB);

  // A выдаёт доступ B и C через диалог «Доступ»
  await pageA.goto(`/note/${slug}`);
  await pageA.locator('[aria-label="Доступ к записи"]').click();
  await expect(pageA.locator(".share-dialog")).toBeVisible();
  await pageA
    .locator(".share-dialog-row", { hasText: emailB })
    .locator(".share-dialog-add")
    .click();
  await pageA
    .locator(".share-dialog-row", { hasText: emailC })
    .locator(".share-dialog-add")
    .click();
  // обе строки переехали в «Есть доступ» — крестик-отзыв виден
  await expect(
    pageA.locator(".share-dialog-row", { hasText: emailB }).locator(".share-dialog-x")
  ).toBeVisible();

  // B и C теперь видят полную запись
  await pageB.goto(`/note/${slug}`);
  await hasFullAccess(pageB);
  await pageC.goto(`/note/${slug}`);
  await hasFullAccess(pageC);

  // A отзывает доступ только у B (крестик у строки B)
  await pageA
    .locator(".share-dialog-row", { hasText: emailB })
    .locator(".share-dialog-x")
    .click();
  // после отзыва у строки B больше нет крестика (вернулась в «выдать доступ»),
  // а у строки C крестик остаётся.
  await expect(
    pageA.locator(".share-dialog-row", { hasText: emailB }).locator(".share-dialog-x")
  ).toHaveCount(0);
  await expect(
    pageA.locator(".share-dialog-row", { hasText: emailC }).locator(".share-dialog-x")
  ).toBeVisible();

  // у B доступ пропал, у C — остался (индивидуальный отзыв)
  await pageB.goto(`/note/${slug}`);
  await noAccess(pageB);
  await pageC.goto(`/note/${slug}`);
  await hasFullAccess(pageC);

  await ctxA.close();
  await ctxB.close();
  await ctxC.close();
});

test("этап C ч.2: коллективная подготовка — виджет и переключение режима экзамена", async ({
  page,
  request,
}) => {
  const PB = "http://127.0.0.1:8090";
  // демо-юзер владеет сид-экзаменом math-analysis (mode solo)
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "demo" }
  );
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("asyaobraz17@gmail.com");
  const pw = page.locator('input[type="password"]');
  await pw.fill("12345678");
  await pw.press("Enter");
  await page.waitForURL("**/s/demo");

  // включаем режим Группа
  await page
    .locator(".mode-toggle-btn", { hasText: "Группа" })
    .dispatchEvent("click");
  await page.waitForURL(/\/s\/demo\/group$/);

  // центр подготовки экзамена курса
  await page.goto("/s/demo/math-analysis/exam");
  const collectiveWidget = page.locator(".widget", {
    hasText: "Коллективная подготовка",
  });
  await expect(collectiveWidget).toBeVisible({ timeout: 10000 });

  // после переключения — появляется виджет «Участники»
  // dispatchEvent — обход headed-Firefox «.click() hang» (правило проекта).
  await collectiveWidget
    .locator(".btn-primary", { hasText: "Открыть коллективную подготовку" })
    .dispatchEvent("click");
  await expect(
    page.locator(".widget", { hasText: "Участники" })
  ).toBeVisible({ timeout: 10000 });

  // откат: вернуть сид-экзамен в solo напрямую через PocketBase API,
  // чтобы не мутировать демо-БД для остальных спеков.
  const auth = await request
    .post(`${PB}/api/collections/users/auth-with-password`, {
      data: { identity: "asyaobraz17@gmail.com", password: "12345678" },
    })
    .then((r) => r.json());
  const exams = await request
    .get(`${PB}/api/collections/exams/records?perPage=100`, {
      headers: { Authorization: auth.token },
    })
    .then((r) => r.json());
  for (const ex of exams.items ?? []) {
    if (ex.mode === "group") {
      await request.patch(`${PB}/api/collections/exams/records/${ex.id}`, {
        headers: { Authorization: auth.token },
        data: { mode: "solo" },
      });
    }
  }
});
