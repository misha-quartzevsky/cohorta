// Проверка B4 v2: билеты без привязок открываются без ошибок; привязка и снятие лекции из окна.
// node scripts/b4-check.mjs  (добавляет и снимает одну лекцию у билета №3 (порядок привязок сохраняется))
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//);
let bad = 0;
for (let n = 1; n <= 8; n++) {
  await p.goto(`${BASE}/s/demo/math-analysis/exam/${n}`);
  await p.waitForTimeout(900);
  const ok = await p.getByRole("heading", { name: "Связанные лекции" }).isVisible().catch(() => false);
  if (!ok) { bad++; console.log("билет", n, "не открылся"); }
}
await p.goto(`${BASE}/s/demo/math-analysis/exam/3`);
await p.waitForTimeout(900);
const before = await p.locator(".c-ticket-source-row").count();
await p.getByRole("button", { name: "Привязать лекцию" }).click();
await p.locator(".c-picker-row").nth(0).click();
await p.getByRole("button", { name: /^Привязать \(/ }).click();
await p.waitForTimeout(1200);
const after = await p.locator(".c-ticket-source-row").count();
console.log("строк до/после привязки:", before, after);
await p.getByRole("button", { name: /Отвязать|Убрать/ }).last().click(); // добавленная лекция идёт последней
await p.waitForTimeout(1200);
console.log("после снятия:", await p.locator(".c-ticket-source-row").count());
console.log("не открылись:", bad, "ошибки консоли:", errors.length, errors.slice(0, 3));
await b.close();
