// Скриншоты волны B4 v2: node scripts/b4-shots.mjs <папка>
// 1440x900 и 390x844: хаб экзамена, билет, окно привязки лекций, «Добавить билет», импорт со списком,
// пустой экзамен и форма «Новый экзамен» (на предмете без экзамена). Ничего не сохраняет.
import { chromium } from "playwright";

const out = process.argv[2];
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const email = arg("email", process.env.DEMO_EMAIL);
const password = arg("password", process.env.DEMO_PASSWORD);
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const withExam = "/s/demo/math-analysis";
const noExam = "/s/demo/physics";
const LIST = "1. Оферта и акцепт\n2) Виды сделок\n\nФорма сделки\n7 сил Портера";

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
  const go = async (path) => {
    await p.goto(`${BASE}${path}`);
    await p.waitForTimeout(1500);
  };

  await go(`${withExam}/exam`);
  await shot("hub");
  if (!phone) {
    await p.getByRole("button", { name: "Подсказка" }).click();
    await p.waitForTimeout(300);
    await shot("hub-tip");
    await p.keyboard.press("Escape");
  }
  await go(`${withExam}/pairs`);
  await shot("pairs");
  await go(`${withExam}`);
  await shot("lectures");

  await go(`${withExam}/exam`);
  await p.getByRole("button", { name: "Добавить билет" }).first().click();
  await p.waitForTimeout(400);
  await shot("add-ticket");
  await p.keyboard.press("Escape");

  await go(`${withExam}/exam/import`);
  await p.locator("textarea").first().fill(LIST);
  await p.waitForTimeout(400);
  await shot("import");

  await go(`${withExam}/exam/1`);
  await shot("ticket");
  await p.getByRole("button", { name: "Привязать лекцию" }).click();
  await p.waitForTimeout(500);
  await shot("picker");
  await p.getByRole("radio", { name: /Открытые мне/ }).click();
  await p.waitForTimeout(300);
  await shot("picker-opened");
  await p.keyboard.press("Escape");

  await go(`${noExam}/exam`);
  await shot("empty");
  await p.getByRole("button", { name: "Создать экзамен" }).click();
  await p.waitForTimeout(600);
  await shot("form-exam");
}
await b.close();
