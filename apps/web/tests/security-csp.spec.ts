/**
 * ============================================
 *  tests/security-csp.spec.ts — Content-Security-Policy не ломает приложение (C-6 / D-8)
 * ============================================
 *
 * Аудит 2026-10. Прогоняет приложение, отданное С заголовками безопасности (security-headers.ts: тот же CSP, что
 * Cloudflare Pages берёт из dist/_headers), и требует ноль нарушений CSP на всех экранах, в редакторе с формулами
 * MathLive, в схеме Excalidraw (шрифты, wasm, blob), при загрузке картинки и в квизе.
 *
 * Запуск (нужны PocketBase песочницы на E2E_PB_PORT и сборка с его адресом):
 *   VITE_PB_URL=http://127.0.0.1:8091 VITE_POCKETBASE_URL=http://127.0.0.1:8091 npx vite build --outDir dist/csp-check
 *   VITE_PB_URL=http://127.0.0.1:8091 VITE_POCKETBASE_URL=http://127.0.0.1:8091 npx vite preview --outDir dist/csp-check --port 5176
 *   CSP_BASE_URL=http://localhost:5176 PB_URL=http://127.0.0.1:8091 npx playwright test tests/security-csp.spec.ts
 * Без CSP_BASE_URL тест пропускается (обычный прогон идёт на dev-сервере без заголовков).
 */
import { test, expect, type Page } from "@playwright/test";
import { registerFresh } from "./helpers";
import { PB, createLecture, h, list, register, uid } from "./group-api";

const BASE = process.env.CSP_BASE_URL;
test.skip(!BASE, "нужен фронтенд с заголовками безопасности (CSP_BASE_URL, см. шапку файла)");
test.use({ baseURL: BASE });

/**
 * Единственное известное исключение: Excalidraw к каждому локальному шрифту (/excalidraw-fonts/) добавляет запасной адрес на
 * https://esm.sh/@excalidraw/… (зашито в библиотеку, отключить нельзя). Политика его не разрешает (font-src без сторонних хостов),
 * шрифты берутся локальные, схема работает. В public лежат не все файлы (CJK-шрифт Xiaolai, 13 МБ, не включён).
 * Решение «разрешить esm.sh в font-src» или «положить Xiaolai в public» за владелицей (см. отчёт, раздел «Волна 1: статус»).
 */
const KNOWN_FONT_FALLBACK = /font-src.*https:\/\/esm\.sh\/@excalidraw\//;

/** Нарушения CSP (событие securitypolicyviolation и сообщения консоли) + ошибки страницы. */
function watch(page: Page) {
  const found: string[] = [];
  void page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ← ${e.blockedURI || e.sample || "inline"}`);
    });
  });
  page.on("console", (m) => {
    if (/content security policy|violates the following/i.test(m.text())) found.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => {
    if (/content security policy|EvalError|unsafe-eval/i.test(String(e))) found.push(`pageerror: ${String(e).slice(0, 200)}`);
  });
  return async (where: string) => {
    const fromDom = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []).catch(() => []);
    const all = [...found, ...fromDom].filter((v) => !KNOWN_FONT_FALLBACK.test(v));
    expect(all, `нарушения CSP: ${where}`).toEqual([]);
  };
}

test("страница отдаётся с заголовками безопасности", async ({ request }) => {
  const r = await request.get("/");
  const hd = r.headers();
  expect(hd["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(hd["content-security-policy"]).toContain(`connect-src 'self' ${new URL(PB).origin}`);
  expect(hd["content-security-policy"]).not.toContain("'unsafe-eval'");
  expect(hd["content-security-policy"]).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(hd["x-frame-options"]).toBe("DENY");
  expect(hd["x-content-type-options"]).toBe("nosniff");
  expect(hd["referrer-policy"]).toBeTruthy();
  expect(hd["permissions-policy"]).toContain("microphone=(self)");
});

test("экраны, редактор с формулами, схема Excalidraw, загрузка картинки, квиз: ноль нарушений CSP", async ({ page, request }) => {
  test.setTimeout(240_000);
  const check = watch(page);
  const email = await registerFresh(page, "csp");
  const auth = await (await request.post(`${PB}/api/collections/users/auth-with-password`, { data: { identity: email, password: "test12345" } })).json();
  const me = { id: auth.record.id as string, token: auth.token as string, email };
  const sem = (await list(request, me, "semesters", `slug="1"`))[0];
  const courseSlug = `csp-${uid()}`;
  const course = await (await request.post(`${PB}/api/collections/courses/records`, { headers: h(me), data: { name: "CSP", owner: me.id, slug: courseSlug, semesters: sem.id } })).json();
  const lectureSlug = `csp-l-${uid()}`;
  const lecture = await (
    await request.post(`${PB}/api/collections/lectures/records`, {
      headers: h(me),
      data: { title: "Лекция CSP", slug: lectureSlug, owner: me.id, field: course.id, content: `<h2>Тема</h2><p>${"Текст про предмет. ".repeat(20)}</p><div data-type="math-block" data-latex="\\frac{a}{b}"></div>` },
    })
  ).json();
  await createLecture(request, me, "Вторая лекция CSP", { field: course.id });
  const deck = await (await request.post(`${PB}/api/collections/decks/records`, { headers: h(me), data: { title: "Колода CSP", slug: `d-${uid()}`, owner: me.id } })).json();
  await request.post(`${PB}/api/collections/deck_cards/records`, { headers: h(me), data: { deck: deck.id, front: "<p>q</p>", back: "<p>a</p>" } });

  const L = `/s/1/${courseSlug}/${lectureSlug}`;
  const routes = [
    "/", "/s/1", "/s/1/lectures", `/s/1/${courseSlug}`, L, `${L}/edit`, `/s/1/${courseSlug}/exam`, `/s/1/${courseSlug}/exam/import`,
    `/s/1/${courseSlug}/pairs`, "/schedule", "/tasks", "/decks", `/decks/${deck.slug}`, `/decks/${deck.slug}/review`, "/settings",
    "/settings/periods", "/trash", "/profile", "/s/1/group", "/s/1/group/new", "/s/1/drafts", "/privacy", `/quiz/${lecture.id}`,
  ];
  for (const path of routes) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await check(path);
  }

  // редактор: формула MathLive (блок и окно ввода), схема Excalidraw, картинка
  await page.goto(`${L}/edit`, { waitUntil: "networkidle" });
  const editor = page.locator(".tiptap-editor").first();
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/Формула");
  await page.locator(".slash-menu-item", { hasText: "Формула" }).first().click();
  await page.waitForTimeout(1500);
  await expect(page.locator(".math-overlay")).toBeVisible();
  await check("формула (MathLive)");
  await page.keyboard.press("Escape");

  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/Схема");
  await page.locator(".slash-menu-item", { hasText: "Схема" }).first().click();
  await page.waitForTimeout(4000); // Excalidraw: чанк, шрифты, wasm
  await expect(page.locator(".sketch-modal-canvas .excalidraw").first()).toBeVisible();
  await check("схема (Excalidraw)");
  await page.keyboard.press("Escape");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/Картинка");
  const chooser = page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null);
  await page.locator(".slash-menu-item", { hasText: "Картинка" }).first().click();
  const fc = await chooser;
  if (fc) await fc.setFiles({ name: "p.png", mimeType: "image/png", buffer: png });
  expect(fc, "открылся выбор файла").not.toBeNull();
  await expect(page.locator(".tiptap-editor img").first()).toBeVisible({ timeout: 10_000 });
  await check("загрузка картинки");

  // квиз: открыть и дойти до экрана вопросов (если генерация недоступна, достаточно, что экран открылся без нарушений)
  await page.goto(`/quiz/${lecture.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await check("квиз");
  const reg = await register(request, "csp-unused");
  expect(reg.id).toBeTruthy();
});
