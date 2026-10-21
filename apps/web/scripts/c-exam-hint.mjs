// Подсказка «В твоей группе уже есть экзамен по этому предмету» в форме «Новый экзамен» (песочница 8092, приложение 5174).
// node scripts/c-exam-hint.mjs <папка> [--create]   (--create нажимает «Создать экзамен» и проверяет, что билеты группы скопировались)
import { chromium } from "playwright";
const out = process.argv[2];
const BASE = "http://127.0.0.1:5174";
const PB = "http://127.0.0.1:8092";
const api = async (m, u, t, b) => (await fetch(PB + u, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
const tok = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: "asyaobraz17@gmail.com", password: "12345678" })).token;
// у демо-аккаунта нет «Гражданского права», а в группе по нему есть экзамен: создаём такой предмет (на песочнице)
const me = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: "asyaobraz17@gmail.com", password: "12345678" })).record.id;
let course = (await api("GET", `/api/collections/courses/records?filter=${encodeURIComponent('name="Гражданское право"')}`, tok)).items[0];
if (!course) course = await api("POST", "/api/collections/courses/records", tok, { name: "Гражданское право", owner: me, slug: "grazhdanskoe-pravo", cover_seed: 60 });
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const phone = w < 500;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
  await p.fill('input[type="password"]', "12345678");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/s\//, { timeout: 15000 });
  await p.goto(`${BASE}/s/demo/${course.slug}/exam`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/exam-hub${phone ? "-m" : ""}.png` });
  await p.getByRole("button", { name: /Создать экзамен/ }).first().click();
  await p.waitForTimeout(800);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/exam-hint${phone ? "-m" : ""}.png` });
  const text = await p.locator("body").innerText();
  console.log(w, "подсказка видна:", text.includes("В твоей группе уже есть экзамен по этому предмету"));
  if (process.argv.includes("--create") && !phone) {
    await p.getByRole("button", { name: "Создать экзамен" }).last().click();
    await p.waitForTimeout(2500);
    const mine = await api("GET", `/api/collections/exams/records?filter=${encodeURIComponent(`course="${course.id}"`)}`, tok);
    const tickets = await api("GET", `/api/collections/exam_tickets/records?filter=${encodeURIComponent(`exam="${mine.items[0].id}"`)}`, tok);
    console.log("билетов в личном экзамене после присоединения:", tickets.items.length);
  }
  await ctx.close();
}
await b.close();
