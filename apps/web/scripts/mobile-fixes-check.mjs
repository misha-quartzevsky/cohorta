// Проверка телефона 390 px (mobile-fixes): node scripts/mobile-fixes-check.mjs <папка скриншотов> <суффикс: before|after>
// Для каждого экрана: скриншот, scrollWidth <= innerWidth, список элементов, выходящих за правый край.
import { chromium } from "playwright";

const out = process.argv[2];
const tag = process.argv[3] ?? "after";
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const email = arg("email", process.env.DEMO_EMAIL);
const password = arg("password", process.env.DEMO_PASSWORD);
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
let failed = 0;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', email);
await p.fill('input[type="password"]', password);
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
const sem = new URL(p.url()).pathname.split("/")[2];

async function measure(name) {
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${name}-${tag}.png` });
  const r = await p.evaluate(() => {
    const w = window.innerWidth;
    const se = document.scrollingElement;
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const rc = el.getBoundingClientRect();
      if (rc.width === 0 || rc.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.position === "fixed" && rc.left < 0) continue;
      if (rc.right > w + 1) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} right=${Math.round(rc.right)}`);
    }
    return { scrollWidth: se.scrollWidth, w, bad: bad.slice(0, 6) };
  });
  const ok = r.scrollWidth <= r.w;
  if (!ok) failed += 1;
  console.log(ok ? "ok  " : "FAIL", name, `scrollWidth=${r.scrollWidth}/${r.w}`, r.bad.length ? r.bad.join(" | ") : "");
}

// Открыть лекцию, чтобы на Главной появилась карточка «Продолжить»
await p.goto(`${BASE}/s/${sem}/lectures`);
await p.waitForTimeout(1200);
await p.locator(".c-lec-row, [class*=c-lec] a, [class*=c-lec-row]").first().click().catch(() => {});
await p.waitForTimeout(1500);

for (const [name, path] of [
  ["home", `/s/${sem}`],
  ["lectures", `/s/${sem}/lectures`],
  ["schedule", "/schedule"],
  ["tasks", "/tasks"],
  ["more", "/more"],
  ["profile", "/profile"],
  ["settings-periods", "/settings/periods"],
]) {
  await p.goto(`${BASE}${path}`);
  await measure(name);
}

// Шторка «Период» (строка периода)
await p.goto(`${BASE}/settings/periods`);
await p.waitForTimeout(800);
await p.locator(".c-periods-m .c-m-list > *").first().click().catch(() => {});
await measure("sheet-period");
await p.keyboard.press("Escape");

// Шторка «Новый предмет»
await p.goto(`${BASE}/s/${sem}/lectures`);
await p.waitForTimeout(800);
await p.getByRole("radio", { name: "Предметы" }).click().catch(() => {});
await p.getByRole("button", { name: /Новый предмет/ }).first().click().catch(() => {});
await measure("sheet-subject");
await p.keyboard.press("Escape");

// Шторка «Новая пара»
await p.goto(`${BASE}/schedule?add=1`);
await measure("sheet-pair");
await p.keyboard.press("Escape");

// Поиск
await p.goto(`${BASE}/s/${sem}/lectures`);
await p.waitForTimeout(800);
await p.locator(".c-search-m").click().catch(() => {});
await p.fill('input[type="search"][aria-label="Поиск по продукту"]', "а").catch(() => {});
await measure("search");

await b.close();
console.log(failed ? `ПРОВАЛЕНО: ${failed}` : "ВСЕ ЭКРАНЫ ВЛЕЗАЮТ В 390");
process.exit(failed ? 1 : 0);
