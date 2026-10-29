// Скриншоты экранов B6: node scripts/b6-shot.mjs <папка> [--anon] имя=/путь ...
// Снимает 1440x900 и 390x844 (имя-1440.png, имя-390.png). Демо-вход по умолчанию.
import { chromium } from "playwright";
const [out, ...rest] = process.argv.slice(2);
const anon = rest.includes("--anon");
const pages = rest.filter((a) => a.includes("="));
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  const p = await ctx.newPage();
  if (!anon) {
    await p.goto(`${BASE}/login`);
    await p.fill('input[type="email"]', process.env.DEMO_EMAIL);
    await p.fill('input[type="password"]', process.env.DEMO_PASSWORD);
    await p.click('button[type="submit"]');
    await p.waitForURL(/\/s\//, { timeout: 15000 });
  }
  for (const pg of pages) {
    const [name, path] = pg.split("=");
    await p.goto(BASE + path);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: false });
  }
  await ctx.close();
}
await b.close();
