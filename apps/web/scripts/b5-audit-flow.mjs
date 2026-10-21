// Сверка B5, состояния квиза и окна: node scripts/b5-audit-flow.mjs <папка> [desktop|mobile]
// Запросы /api/quiz/generate подменяются (ошибка, лимит, ожидание), ИИ не вызывается.
import { chromium } from "playwright";
import PocketBase from "pocketbase";

const out = process.argv[2];
const mode = process.argv[3] ?? "desktop";
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";
const mobile = mode === "mobile";

const pb = new PocketBase(PB);
await pb.collection("users").authWithPassword("asyaobraz17@gmail.com", "12345678");
const idOf = async (slug) => (await pb.collection("lectures").getFirstListItem(`slug="${slug}"`)).id;
const LECT = (slug) => `/s/demo/math-analysis/${slug}`;

const b = await chromium.launch();
const ctx = await b.newContext(
  mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
);
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
const shot = (n) => p.screenshot({ path: `${out}/${mode}-${n}.png` });
const tap = (loc) => (mobile ? loc.tap() : loc.click());

async function openPanel() {
  if (!mobile) return;
  await p.getByRole("button", { name: "Понимание", exact: true }).tap().catch(() => {});
  await p.waitForTimeout(500);
}

// 1. размер
await p.goto(`${BASE}${LECT("b5-no-quiz")}`);
await p.waitForTimeout(1800);
await openPanel();
await shot("panel-none");
await tap(p.getByRole("button", { name: "Создать квиз" }).first());
await p.waitForTimeout(500);
await shot("dlg-choose");

// 3. ошибка
await p.route("**/api/quiz/generate", (r) => r.fulfill({ status: 502, contentType: "application/json", body: '{"error":"generation_failed"}' }));
await tap(p.getByRole("button", { name: "Создать", exact: true }));
await p.waitForTimeout(1200);
await shot("dlg-error");
await p.unroute("**/api/quiz/generate");

// 2. ожидание
await p.route("**/api/quiz/generate", async (r) => {
  await new Promise((res) => setTimeout(res, 6000));
  await r.fulfill({ status: 502, contentType: "application/json", body: '{"error":"generation_failed"}' });
});
await tap(p.getByRole("button", { name: "Попробовать снова" }));
await p.waitForTimeout(800);
await shot("dlg-waiting");
await p.waitForTimeout(6500);
await p.unroute("**/api/quiz/generate");
await p.keyboard.press("Escape");

// 5. лимит (квиза нет → только «Понятно»)
await p.goto(`${BASE}${LECT("b5-no-quiz")}`);
await p.waitForTimeout(1500);
await openPanel();
await p.route("**/api/quiz/generate", (r) => r.fulfill({ status: 429, contentType: "application/json", body: '{"error":"daily_limit","limit":5,"used":5}' }));
await tap(p.getByRole("button", { name: "Создать квиз" }).first());
await p.waitForTimeout(400);
await tap(p.getByRole("button", { name: "Создать", exact: true }));
await p.waitForTimeout(1200);
await shot("dlg-limit-noquiz");

// 5б. лимит при готовом квизе
await p.goto(`${BASE}${LECT("b5-quiz-created")}`);
await p.waitForTimeout(1500);
await openPanel();
await tap(p.getByRole("button", { name: "Собрать другой" }));
await p.waitForTimeout(400);
await tap(p.getByRole("button", { name: "Создать", exact: true }));
await p.waitForTimeout(1200);
await shot("dlg-limit-hasquiz");
await p.unroute("**/api/quiz/generate");

// 4. мало текста
await p.goto(`${BASE}${LECT("b5-short-text")}`);
await p.waitForTimeout(1500);
await openPanel();
await tap(p.getByRole("button", { name: "Создать квиз" }).first());
await p.waitForTimeout(600);
await shot("dlg-short");

// прохождение: ответ и итог
await p.goto(`${BASE}${LECT("b5-quiz-created")}`);
await p.waitForTimeout(1200);
const qid = await idOf("b5-quiz-created");
await p.goto(`${BASE}/quiz/${qid}`);
await p.waitForTimeout(1500);
await shot("quiz-q1");
for (let i = 0; i < 8; i++) {
  const opts = p.locator(".c-quiz-opt");
  if (await opts.count()) {
    await tap(opts.nth(1));
    await tap(p.getByRole("button", { name: "Ответить" }));
  } else {
    await tap(p.getByRole("button", { name: "Показать ответ" }));
    await tap(p.getByRole("button", { name: "Не помню" }));
  }
  await p.waitForTimeout(500);
  if (i === 0) await shot("quiz-answered");
  await tap(p.getByRole("button", { name: "Дальше" }));
  await p.waitForTimeout(400);
  if (i === 1) await shot("quiz-q3");
}
await p.waitForTimeout(800);
await shot("quiz-summary");
await b.close();
