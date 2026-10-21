// Быстрый снимок страниц группы: node scripts/c-quick-shot.mjs <папка> <w> <путь>[,<путь>…]  (песочница на 8092, приложение на 5174)
import { chromium } from "playwright";
const [out, w, paths] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://127.0.0.1:5174";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8092";
const api = async (m, u, t, b) => (await fetch(PB + u, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
const tok = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: "asyaobraz17@gmail.com", password: "12345678" })).token;
const mk = (await api("GET", `/api/collections/groups/records?filter=${encodeURIComponent('name="МК-31"')}`, tok)).items[0].id;
const b = await chromium.launch();
const phone = Number(w) < 500;
const ctx = await b.newContext({ viewport: { width: Number(w), height: 900 }, deviceScaleFactor: phone ? 2 : 1 });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
await p.evaluate((g) => { localStorage.setItem("cohorta:mode", "group"); localStorage.setItem("cohorta:group", g); }, mk);
for (const path of paths.split(",")) {
  await p.goto(`${BASE}${path}`);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/${path.replace(/[^a-z0-9]+/gi, "_")}-${w}.png` });
}
await b.close();
