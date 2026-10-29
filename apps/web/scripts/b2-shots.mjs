// Скриншоты волны B2: node scripts/b2-shots.mjs <папка> [--email=… --password=…]
// Снимает 1440x900 и 390x844: «Все лекции», вкладка «Предметы», окно «Период»,
// страница предмета, поиск. Демо-вход по умолчанию. Предмет — первый в сайдбаре.
import { chromium } from "playwright";

const out = process.argv[2];
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const email = arg("email", process.env.DEMO_EMAIL);
const password = arg("password", process.env.DEMO_PASSWORD);
const sem = arg("sem", "demo");
const subject = arg("subject", "math-analysis");
const query = arg("q", "ле");
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";

const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const phone = w < 500;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', password);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/s\//, { timeout: 15000 });
  const shot = (name) => p.screenshot({ path: `${out}/${name}-${w}.png` });

  await p.goto(`${BASE}/s/${sem}/lectures`);
  await p.waitForTimeout(1500);
  await shot("lectures");
  if (phone) {
    await p.getByRole("radio", { name: "Предметы" }).click();
    await p.waitForTimeout(800);
    await shot("lectures-subjects");
    await p.getByRole("button", { name: /^Период/ }).click();
    await p.waitForTimeout(500);
    await shot("lectures-period");
    await p.keyboard.press("Escape");
  }

  await p.goto(`${BASE}/s/${sem}/${subject}`);
  await p.waitForTimeout(1500);
  await shot("subject");

  await p.goto(`${BASE}/s/${sem}/lectures`);
  await p.waitForTimeout(800);
  if (phone) await p.locator(".c-search-m").click();
  else await p.locator(".c-shell-side-search").click();
  await p.fill('input[type="search"][aria-label="Поиск по продукту"]', query);
  await p.waitForTimeout(1200);
  await shot("search");
  await ctx.close();
}
await b.close();
