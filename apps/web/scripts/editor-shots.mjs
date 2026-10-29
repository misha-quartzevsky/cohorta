// Скриншоты десктопного редактора: node scripts/editor-shots.mjs <папка> [префикс]
// 1440x900: лекция с заголовками, лекция без заголовков, лекция без предмета.
import { chromium } from "playwright";

const out = process.argv[2];
const pre = process.argv[3] ?? "";
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const pages = [
  ["lecture", "/s/1/storitelling/test"],
  ["lecture-short", "/s/demo/math-analysis/limit-of-sequence"],
  ["draft", "/note/zametka-test"],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', process.env.DEMO_EMAIL);
await p.fill('input[type="password"]', process.env.DEMO_PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
for (const [name, path] of pages) {
  await p.goto(`${BASE}${path}`);
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${out}/${pre}${name}.png` });
}
await b.close();
