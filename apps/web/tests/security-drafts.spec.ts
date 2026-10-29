/**
 * ============================================
 *  tests/security-drafts.spec.ts — черновики лекций и смена пользователя на одном устройстве (C-5)
 * ============================================
 *
 * Аудит 2026-10. Несохранённый текст лекции лежал в localStorage без привязки к человеку: после выхода он оставался на
 * общем устройстве, а при входе другого человека очередь удаляла чужой черновик (404) или пыталась его отправить.
 * Теперь ключ и тело записи содержат id пользователя, выход очищает черновики этого человека, запуск очереди удаляет чужие.
 * Юнит-тесты: src/lib/draftQueue.test.ts, src/services/draftSync.test.ts.
 */
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { registerFresh } from "./helpers";
import { PB, h, list, uid } from "./group-api";

const draftKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cohorta:draft:")));

/** Лекция с текстом у вошедшего пользователя; возвращает адрес редактирования и id пользователя. */
async function setup(page: Page, request: APIRequestContext, prefix: string) {
  const email = await registerFresh(page, prefix);
  const auth = await (await request.post(`${PB}/api/collections/users/auth-with-password`, { data: { identity: email, password: "test12345" } })).json();
  const me = { id: auth.record.id as string, token: auth.token as string, email };
  const sem = (await list(request, me, "semesters", `slug="1"`))[0];
  const courseSlug = `dr-${uid()}`;
  const course = await (await request.post(`${PB}/api/collections/courses/records`, { headers: h(me), data: { name: "Черновики", owner: me.id, slug: courseSlug, semesters: sem.id } })).json();
  const slug = `dr-l-${uid()}`;
  const lecture = await (
    await request.post(`${PB}/api/collections/lectures/records`, { headers: h(me), data: { title: "Лекция для черновика", slug, owner: me.id, field: course.id, content: "<p>исходный текст</p>" } })
  ).json();
  return { me, lectureId: lecture.id as string, edit: `/s/1/${courseSlug}/${slug}/edit` };
}

/** Набрать текст без связи: автосохранение не доходит до сервера и кладёт черновик в localStorage. */
async function typeOffline(page: Page, ctx: BrowserContext, text: string) {
  await page.waitForSelector(".tiptap-editor");
  await ctx.setOffline(true);
  await page.locator(".tiptap-editor").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}

test("черновик привязан к пользователю; выход очищает; чужой черновик не отправляется и не удаляется как «свой»", async ({ page, request, context }) => {
  test.setTimeout(240_000);
  const a = await setup(page, request, "dr-a");
  await page.goto(a.edit);
  await typeOffline(page, context, " ЧЕРНОВИК-АЛИСЫ");
  await expect.poll(() => draftKeys(page), { timeout: 30_000 }).toHaveLength(1);
  const [key] = await draftKeys(page);
  expect(key, "в ключе id пользователя").toContain(a.me.id);
  const body = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) as string);
  expect(body.uid, "в теле записи id пользователя").toBe(a.me.id);
  expect(body.content).toContain("ЧЕРНОВИК-АЛИСЫ");

  // 1. сессия истекла (токен просрочен, запись пользователя остаётся): черновик не теряется
  await context.setOffline(false);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("pocketbase_auth") as string);
    const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    raw.token = `${part({ alg: "none" })}.${part({ exp: 1 })}.x`;
    localStorage.setItem("pocketbase_auth", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForURL("**/login", { timeout: 20_000 });
  expect(await draftKeys(page), "после истечения сессии черновик Алисы остался").toEqual([key]);

  // 2. на этом устройстве входит другой человек: чужой черновик не виден ему, удаляется и не уходит на сервер
  await page.evaluate(() => localStorage.removeItem("pocketbase_auth"));
  const b = await setup(page, request, "dr-b");
  await page.goto(b.edit);
  await page.waitForSelector(".tiptap-editor");
  await expect.poll(() => draftKeys(page), { timeout: 20_000 }).toEqual([]);
  const lecture = await (await request.get(`${PB}/api/collections/lectures/records/${a.lectureId}`, { headers: { Authorization: a.me.token } })).json();
  expect(lecture.content, "текст Алисы не ушёл на сервер от имени Боба").not.toContain("ЧЕРНОВИК-АЛИСЫ");
});

test("выход (кнопка «Выйти») удаляет несохранённый текст с устройства", async ({ page, request, context }) => {
  test.setTimeout(240_000);
  const a = await setup(page, request, "dr-out");
  await page.goto(a.edit);
  await typeOffline(page, context, " ЧЕРНОВИК-ПЕРЕД-ВЫХОДОМ");
  await expect.poll(() => draftKeys(page), { timeout: 30_000 }).toHaveLength(1);

  // в приложении без перезагрузки: профиль → «Выйти» (без связи отправить нечего, ожидание ограничено 3 секундами)
  // несохранённый текст не ушёл: приложение спрашивает подтверждение выхода
  let asked = "";
  page.on("dialog", (d) => {
    asked = d.message();
    void d.accept();
  });
  await page.locator(".c-shell-profile").first().dispatchEvent("click");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL("**/login", { timeout: 20_000 });
  expect(asked, "спросили подтверждение").toContain("несохранённый текст");
  expect(await draftKeys(page), "после выхода черновиков не осталось").toEqual([]);
  await context.setOffline(false);
});
