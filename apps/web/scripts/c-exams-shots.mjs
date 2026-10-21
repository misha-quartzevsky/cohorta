// Скриншоты экзаменов группы (волна C, этап 2): node scripts/c-exams-shots.mjs <папка> '<json из c-exams-seed.mjs>'
// 1440x900 и 390x844. Ничего не меняет, кроме блокировки билета (её занимает Лена и она истекает через 30 секунд).
import { chromium } from "playwright";

const out = process.argv[2];
const ids = JSON.parse(process.argv[3]);
const BASE = process.env.BASE ?? "http://127.0.0.1:5174";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8092";
const PASS = "Test-pass-12345";
const sem = "demo";

async function api(method, url, token, body) {
  const r = await fetch(PB + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const su = (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS })).body.token;
const lenaRow = (await api("GET", `/api/collections/users/records?filter=${encodeURIComponent('name="Лена Орлова"')}`, su)).body.items[0];
const lena = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: lenaRow.email, password: PASS })).body.token;

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
  const demoToken = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: "asyaobraz17@gmail.com", password: "12345678" })).body.token;
  const mk = (await api("GET", `/api/collections/groups/records?filter=${encodeURIComponent('name="МК-31"')}`, demoToken)).body.items[0].id;
  await p.evaluate((g) => {
    localStorage.setItem("cohorta:mode", "group");
    localStorage.setItem("cohorta:group", g);
  }, mk);
  const shot = (name) => p.screenshot({ path: `${out}/${name}${phone ? "-m" : ""}.png` });
  const go = async (path, wait = 1800) => {
    await p.goto(`${BASE}${path}`);
    await p.waitForTimeout(wait);
  };
  const G = `/s/${sem}/group`;

  await go(`${G}/exams`);
  await shot("exams");
  await p.getByRole("button", { name: "Создать экзамен" }).first().click().catch(() => undefined);
  await p.waitForTimeout(600);
  await shot("form-group-exam");
  await p.keyboard.press("Escape");

  await go(`${G}/exams/${ids.philosophy}`);
  await shot("exam");
  if (!phone) {
    await p.getByRole("button", { name: "Как устроены подгруппы" }).click();
    await p.waitForTimeout(300);
    await shot("exam-bulb");
    await p.keyboard.press("Escape");
  }
  await p.getByRole("button", { name: "Пригласить в подгруппу" }).click().catch(() => undefined);
  await p.waitForTimeout(400);
  await shot("exam-invite");
  await p.keyboard.press("Escape");

  await go(`${G}/exams/${ids.law}`);
  await shot("exam-no-subgroup");
  await p.getByRole("button", { name: "Новая подгруппа" }).first().click();
  await p.waitForTimeout(600);
  await shot("form-subgroup");
  await p.keyboard.press("Escape");

  const T = `${G}/exams/${ids.philosophy}/ticket/3`;
  await go(T);
  await shot("ticket-free");
  await p.getByRole("button", { name: "Редактировать" }).click();
  await p.waitForTimeout(800);
  await shot("ticket-edit");
  await p.getByRole("button", { name: "Отмена" }).scrollIntoViewIfNeeded();
  await p.getByRole("button", { name: "Отмена" }).click();
  await p.waitForTimeout(500);

  // «Занят»: Лена занимает билет
  await api("POST", `/api/tickets/${ids.ticket3}/lock`, lena);
  await go(T, 1200);
  await shot("ticket-busy");

  await p.getByRole("button", { name: "Привязать лекцию" }).click({ timeout: 3000 }).catch(() => undefined);
  await p.waitForTimeout(700);
  await shot("picker");
  await p.keyboard.press("Escape");

  // защищённый просмотр: режим «Соло»
  await p.evaluate(() => localStorage.setItem("cohorta:mode", "solo"));
  await go(T);
  await shot("ticket-protected");
  await ctx.close();
}
await b.close();
console.log("готово");
