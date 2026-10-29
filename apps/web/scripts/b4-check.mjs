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
await p.fill('input[type="email"]', process.env.DEMO_EMAIL);
await p.fill('input[type="password"]', process.env.DEMO_PASSWORD);
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
// снять и вернуть отметку «Готов» у билета №1 (в конце он снова готов), крошки ведут назад
await p.goto(`${BASE}/s/demo/math-analysis/exam/1`);
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Изменить" }).click();
await p.getByRole("button", { name: /Снять отметку/ }).click();
await p.waitForTimeout(800);
console.log("после снятия виден чип:", await p.locator(".c-ticket-meta-row .c-chip").innerText());
await p.getByRole("button", { name: "Отметить готовым" }).click();
await p.waitForTimeout(1000);
console.log("после возврата чип:", await p.locator(".c-ticket-meta-row .c-chip").innerText());
await p.getByRole("link", { name: "Экзамен", exact: true }).first().click();
await p.waitForURL(/\/exam$/);
console.log("крошка «Экзамен» ведёт на хаб:", p.url().endsWith("/exam"));
await p.getByRole("link", { name: "Пары" }).click();
await p.waitForURL(/\/pairs$/);
await p.getByRole("link", { name: /^Лекции/ }).first().click();
await p.waitForTimeout(500);
console.log("вкладки работают:", p.url());
console.log("не открылись:", bad, "ошибки консоли:", errors.length, errors.slice(0, 3));
await b.close();
