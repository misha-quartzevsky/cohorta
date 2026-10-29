// Автозадачи «Предложено»: нажатие ведёт на квиз, галочка создаёт задачу с предметом и лекцией.
// node scripts/b3-suggest-check.mjs <папка скриншотов>
import { chromium } from "playwright";
const out = process.argv[2];
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB ?? "http://127.0.0.1:8090";
let failed = 0;
const check = (ok, msg) => {
  console.log(ok ? "ok  " : "FAIL", msg);
  if (!ok) failed += 1;
};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', process.env.DEMO_EMAIL);
await p.fill('input[type="password"]', process.env.DEMO_PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
await p.goto(`${BASE}/tasks`);
await p.waitForSelector(".c-task-suggested-row", { timeout: 15000 });
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/suggested-after-390.png`, fullPage: false });

const rows = p.locator(".c-task-suggested-row");
const n = await rows.count();
const metas = await rows.locator(".c-task-row-subject").count();
check(n > 0 && metas === n, `у каждой из ${n} подсказок показан предмет (${metas})`);
check((await rows.locator(".c-task-row-lecture").count()) === n, "у каждой подсказки показана метка «Лекция»");

// галочка: задача создаётся с предметом и лекцией, строка пропадает
const title = (await rows.first().locator(".c-task-suggested-title").textContent()) ?? "";
await rows.first().getByRole("checkbox").click();
await p.waitForTimeout(1200);
const created = await p.evaluate(async ({ pb, title }) => {
  const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
  const r = await fetch(`${pb}/api/collections/tasks/records?filter=${encodeURIComponent(`title="${title}"`)}`, { headers: { Authorization: auth.token } });
  const items = (await r.json()).items ?? [];
  return { items, token: auth.token };
}, { pb: PB, title });
const rec = created.items[0];
check(!!rec && !!rec.lecture, `задача создана и привязана к лекции (${rec?.lecture ?? "нет"})`);
check(!!rec && !!rec.subject, `задача создана и привязана к предмету (${rec?.subject ?? "нет"})`);
// уборка: удалить созданные тестом записи
for (const it of created.items) {
  await p.evaluate(async ({ pb, id, token }) => fetch(`${pb}/api/collections/tasks/records/${id}`, { method: "DELETE", headers: { Authorization: token } }), { pb: PB, id: it.id, token: created.token });
}

// нажатие на название ведёт на квиз
await p.goto(`${BASE}/tasks`);
await p.waitForSelector(".c-task-suggested-row", { timeout: 15000 });
const before = p.url();
await p.locator(".c-task-suggested-main").first().click();
await p.locator(".c-dialog").first().waitFor({ timeout: 6000 }).catch(() => {});
await p.waitForTimeout(300);
// квиз уже есть — открывается прохождение; квиза нет — лекция с окном «Создать квиз» (так задумано в QuizPage)
await p.screenshot({ path: `${out}/suggested-click-390.png` });
const url = p.url().replace(BASE, "");
const dialog = await p.locator(".c-dialog").first().isVisible().catch(() => false);
check(/\/quiz\//.test(url) || dialog, `нажатие открыло ${url}${dialog ? " и окно создания квиза" : ""} (было ${before.replace(BASE, "")})`);
await b.close();
console.log(failed ? `ПРОВАЛЕНО: ${failed}` : "ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ");
process.exit(failed ? 1 : 0);
