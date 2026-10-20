// «Черновики»: node scripts/b2-drafts.mjs <папка>. Демо-вход; создаёт лекцию без предмета и удаляет её.
import { chromium } from "playwright";
const OUT = process.argv[2];
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB ?? "http://127.0.0.1:8090";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//);
const made = await p.evaluate(async (pb) => {
  const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
  const h = { "Content-Type": "application/json", Authorization: auth.token };
  const r = await fetch(`${pb}/api/collections/lectures/records`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ title: "Тест черновика", content: "", slug: `test-draft-${Date.now()}`, owner: auth.record?.id }),
  });
  return { status: r.status, id: (await r.json()).id, token: auth.token };
}, PB);
console.log("create:", made.status);
let failed = 0;
try {
  await p.goto(`${BASE}/s/demo/lectures`);
  const row = p.locator(".c-shell-courses a", { hasText: "Черновики" });
  await row.waitFor({ timeout: 8000 });
  console.log("ok   «Черновики» в сайдбаре, первая строка:", (await p.locator(".c-shell-courses a").first().innerText()).replace(/\s+/g, " "));
  await row.click();
  await p.waitForURL(/\/drafts$/);
  await p.waitForSelector(".c-lec-list .c-row");
  console.log("ok   страница черновиков, строк:", await p.locator(".c-lec-list .c-row").count());
  await p.screenshot({ path: `${OUT}/drafts-1440.png` });
} catch (e) {
  failed = 1;
  console.log("FAIL", e.message);
}
await p.evaluate(async ({ pb, id, token }) => {
  await fetch(`${pb}/api/collections/lectures/records/${id}`, { method: "DELETE", headers: { Authorization: token } });
}, { pb: PB, id: made.id, token: made.token });
await b.close();
process.exit(failed);
