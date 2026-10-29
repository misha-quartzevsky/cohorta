// Скриншоты волны B3 v2: node scripts/b3-shots.mjs <папка> [--email=… --password=…]
// 1440x900 и 390x844: расписание, форма пары (новая и занятая клетка), «Задачи» с лампочкой,
// «Пары предмета», окна «Новый предмет» (пустое название) и «Новая колода», периоды учёбы.
// Ничего не создаёт: окна только открываются.
import { chromium } from "playwright";

const out = process.argv[2];
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const email = arg("email", process.env.DEMO_EMAIL);
const password = arg("password", process.env.DEMO_PASSWORD);
const sem = arg("sem", "demo");
const subject = arg("subject", "math-analysis");
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

  await p.goto(`${BASE}/schedule`);
  await p.waitForTimeout(1500);
  await shot("schedule");

  // форма новой пары: десктоп — кнопка «Добавить пару», телефон — по ?add=1
  await p.goto(`${BASE}/schedule?add=1`);
  await p.waitForTimeout(1000);
  await shot("form-pair-new");
  await p.keyboard.press("Escape");

  await p.goto(`${BASE}/tasks`);
  await p.waitForTimeout(1500);
  await shot("tasks");
  if (!phone) {
    await p.getByRole("button", { name: "Задачи из лекций" }).click();
    await p.waitForTimeout(300);
    await shot("tasks-hint");
    await p.keyboard.press("Escape");
    await p.getByRole("button", { name: /^Период/ }).click();
    await p.waitForTimeout(300);
    await shot("tasks-period");
    await p.keyboard.press("Escape");
  }

  await p.goto(`${BASE}/s/${sem}/${subject}/pairs`);
  await p.waitForTimeout(1500);
  await shot("subject-pairs");

  await p.goto(`${BASE}/s/${sem}/lectures`);
  await p.waitForTimeout(1000);
  if (phone) {
    await p.getByRole("radio", { name: "Предметы" }).click();
    await p.waitForTimeout(500);
  }
  if (phone) await p.getByRole("button", { name: /Новый предмет/ }).first().click();
  else await p.getByLabel("Добавить предмет").click();
  await p.waitForTimeout(500);
  await shot("form-subject");
  await p.keyboard.press("Enter"); // пустое название: подсказка под полем, окно остаётся
  await p.waitForTimeout(300);
  await shot("form-subject-empty");
  await p.keyboard.press("Escape");

  if (!phone) {
    await p.goto(`${BASE}/decks`);
    await p.waitForTimeout(1000);
    await p.getByRole("button", { name: /Новая колода/ }).click();
    await p.waitForTimeout(400);
    await shot("form-deck");
    await p.keyboard.press("Escape");
  }

  await p.goto(`${BASE}/settings/periods`);
  await p.waitForTimeout(1200);
  await shot("settings-periods");
  await ctx.close();
}
await b.close();
