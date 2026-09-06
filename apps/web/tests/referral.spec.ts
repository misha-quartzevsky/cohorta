/**
 * ============================================
 *  tests/referral.spec.ts — реферальная механика (P2)
 * ============================================
 *
 * Единая ссылка: реф-ссылка ≡ ссылка на вступление в группу
 * (`/login?invite=<invite_code>`). Реферер = owner группы.
 *
 * Награда — НЕ за регистрацию, а за активацию: первая написанная
 * лекция приглашённого даёт двусторонний бонус (14 дней премиума
 * + строка premium_grants) приглашённому и владельцу группы.
 * Повторно (вторая лекция) — не начисляется.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { LAST_SEMESTER_KEY, completeOnboardingFast } from "./helpers";

const PB = "http://127.0.0.1:8090";
const PASSWORD = "test12345";

async function registerFresh(page: Page, invite?: string): Promise<string> {
  const email = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "1" }
  );
  await page.goto(invite ? `/login?invite=${invite}` : "/login");
  await page.locator(".login-switch").dispatchEvent("click");
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(PASSWORD);
  await pw.nth(1).fill(PASSWORD);
  await pw.nth(1).press("Enter");
  await completeOnboardingFast(page);
  return email;
}

async function api(request: APIRequestContext, email: string) {
  const r = await request
    .post(`${PB}/api/collections/users/auth-with-password`, {
      data: { identity: email, password: PASSWORD },
    })
    .then((x) => x.json());
  return { token: r.token as string, id: r.record.id as string };
}

async function grantCount(
  request: APIRequestContext,
  token: string
): Promise<number> {
  const r = await request
    .get(`${PB}/api/collections/premium_grants/records`, {
      headers: { Authorization: token },
    })
    .then((x) => x.json());
  return r.totalItems as number;
}

async function userField(
  request: APIRequestContext,
  token: string,
  userId: string,
  field: string
): Promise<string> {
  const r = await request
    .get(`${PB}/api/collections/users/records/${userId}`, {
      headers: { Authorization: token },
    })
    .then((x) => x.json());
  return String(r[field] ?? "");
}

const premiumUntil = (
  request: APIRequestContext,
  token: string,
  userId: string
) => userField(request, token, userId, "premium_until");

const isFuture = (d: string) =>
  !!d && new Date(d.replace(" ", "T")).getTime() > Date.now();

/** Создаёт заметку по заголовку, возвращает slug. */
async function createNote(page: Page, title: string): Promise<string> {
  await page.goto("/note/new");
  const t = page.locator(".lecture-title-input");
  await t.click();
  await t.pressSequentially(title, { delay: 15 });
  await expect(t).toHaveValue(title);
  const save = page.locator(".btn-primary", { hasText: "Сохранить заметку" });
  await expect(save).toBeEnabled();
  await save.dispatchEvent("click");
  await page.waitForURL(/\/note\/(?!new$)[^/]+$/);
  return page.url().match(/\/note\/([^/?#]+)/)?.[1] ?? "";
}

test("бонус за активацию: начисляется обоим после первой лекции, не повторяется", async ({
  browser,
  request,
}) => {
  // A: организатор, создаёт группу
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  const emailA = await registerFresh(pageA);
  await pageA
    .locator(".mode-toggle-btn", { hasText: "Группа" })
    .dispatchEvent("click");
  await pageA.waitForURL(/\/s\/1\/group$/);
  await pageA.locator("#group-name-input").fill(`Ref Поток ${Date.now()}`);
  // Кнопка недоступна, пока не отработал fuzzy-поиск; клик — через
  // dispatchEvent (обычный .click() по этой кнопке завешивает headed-Firefox).
  const createBtn = pageA.locator(".group-primary-btn", {
    hasText: "Создать группу",
  });
  await expect(createBtn).toBeEnabled({ timeout: 5000 });
  await createBtn.dispatchEvent("click");
  await expect(pageA.locator(".group-card")).toBeVisible();
  const inviteText = await pageA.locator(".group-invite-code").textContent();
  const code = (inviteText ?? "").split("invite=")[1]?.trim() ?? "";
  expect(code.length).toBeGreaterThan(3);

  // B: регистрируется по реф-ссылке → автовступление в группу
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  const emailB = await registerFresh(pageB, code);

  const a = await api(request, emailA);
  const b = await api(request, emailB);

  // автовступление + реферальная атрибуция (хук на group_members) завершились
  await expect
    .poll(() => userField(request, b.token, b.id, "invited_by"), {
      timeout: 10000,
    })
    .toBe(a.id);

  // бонус НЕ за регистрацию/вступление
  expect(await grantCount(request, b.token)).toBe(0);
  expect(await grantCount(request, a.token)).toBe(0);
  expect(isFuture(await premiumUntil(request, b.token, b.id))).toBe(false);

  // B пишет первую лекцию → бонус обоим
  await createNote(pageB, `Первый конспект ${Date.now()}`);
  await expect
    .poll(() => grantCount(request, b.token), { timeout: 15000 })
    .toBe(1);
  expect(await grantCount(request, a.token)).toBe(1);
  expect(isFuture(await premiumUntil(request, b.token, b.id))).toBe(true);
  expect(isFuture(await premiumUntil(request, a.token, a.id))).toBe(true);

  // индикатор премиума в профиле — после свежего входа B
  await pageB.locator(".profile-logout").dispatchEvent("click");
  await pageB.waitForURL("**/login");
  await pageB.locator('input[type="email"]').fill(emailB);
  const pw = pageB.locator('input[type="password"]');
  await pw.fill(PASSWORD);
  await pw.press("Enter");
  await pageB.waitForURL(/\/s\//);
  await expect(pageB.locator(".profile-premium")).toContainText("Премиум до");

  // вторая лекция бонус не повторяет
  await createNote(pageB, `Второй конспект ${Date.now()}`);
  await pageB.waitForTimeout(500);
  expect(await grantCount(request, b.token)).toBe(1);

  await ctxA.close();
  await ctxB.close();
});
