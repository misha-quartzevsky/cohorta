/**
 * ============================================
 *  tests/referral.spec.ts — реферальная механика (P2)
 * ============================================
 *
 * Единая ссылка: реф-ссылка ≡ ссылка на вступление в группу
 * (`/join/<invite_code>`). Реферер = owner группы.
 *
 * Награда — НЕ за регистрацию, а за активацию: первая написанная
 * лекция приглашённого даёт двусторонний бонус (14 дней премиума
 * + строка premium_grants) приглашённому и владельцу группы.
 * Повторно (вторая лекция) — не начисляется.
 *
 * Подготовка (аккаунт организатора, группа, лекции) идёт через API: экраны
 * группы и создания заметки переписаны. Регистрация приглашённого — через
 * интерфейс, вступление по коду — через API (по ссылке /join/КОД автовступления нет). Показ «Премиум до» в профиле не проверяется:
 * в новом интерфейсе его нет (решение владельца отложено).
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { LAST_SEMESTER_KEY, completeOnboardingFast } from "./helpers";
import { cleanup, createGroup, createLecture, inviteCode, join, register, type Session } from "./group-api";

const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PASSWORD = "test12345";

async function registerFresh(page: Page): Promise<string> {
  const email = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.addInitScript(
    ({ key, slug }) => localStorage.setItem(key, slug),
    { key: LAST_SEMESTER_KEY, slug: "1" }
  );
  await page.goto("/login");
  await page.locator(".c-auth-switch a").dispatchEvent("click");
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

test("бонус за активацию: начисляется обоим после первой лекции, не повторяется", async ({
  browser,
  request,
}) => {
  // A: организатор. Подготовка через API: аккаунт, группа с открытой ссылкой.
  const sa = await register(request, "ref-a");
  const group = await createGroup(request, sa, `Ref Поток ${Date.now()}`);
  const code = await inviteCode(request, sa, group.id);
  expect(code.length).toBeGreaterThan(3);

  try {
    // B: регистрируется через интерфейс и вступает по коду (через API: в новом интерфейсе ссылка
    // /join/КОД открывает подтверждение, автовступления нет, Screen-group-join-confirm)
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    const emailB = await registerFresh(pageB);
    const b = await api(request, emailB);
    const sb: Session = { id: b.id, token: b.token, email: emailB };
    const joined = await join(request, sb, code);
    expect(joined.ok(), await joined.text()).toBeTruthy();

    // автовступление + реферальная атрибуция (хук на group_members) завершились
    await expect
      .poll(() => userField(request, b.token, b.id, "invited_by"), { timeout: 10000 })
      .toBe(sa.id);

    // бонус НЕ за регистрацию/вступление
    expect(await grantCount(request, b.token)).toBe(0);
    expect(await grantCount(request, sa.token)).toBe(0);
    expect(isFuture(await premiumUntil(request, b.token, b.id))).toBe(false);

    // B пишет первую лекцию (через API) → бонус обоим
    await createLecture(request, sb, `Первый конспект ${Date.now()}`);
    await expect
      .poll(() => grantCount(request, b.token), { timeout: 15000 })
      .toBe(1);
    expect(await grantCount(request, sa.token)).toBe(1);
    expect(isFuture(await premiumUntil(request, b.token, b.id))).toBe(true);
    expect(isFuture(await premiumUntil(request, sa.token, sa.id))).toBe(true);

    // вторая лекция бонус не повторяет
    await createLecture(request, sb, `Второй конспект ${Date.now()}`);
    await pageB.waitForTimeout(500);
    expect(await grantCount(request, b.token)).toBe(1);
    expect(await grantCount(request, sa.token)).toBe(1);

    await ctxB.close();
    await cleanup(request, [sb], []);
  } finally {
    await cleanup(request, [sa], [group.id]);
  }
});
