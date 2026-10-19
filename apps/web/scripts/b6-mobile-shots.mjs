// Скриншоты телефона (390) на одноразовом пользователе с данными: профиль, «Ещё», корзина, периоды, настройки, шторка выбора.
// node scripts/b6-mobile-shots.mjs <папка>
import { chromium } from "playwright";

const OUT = process.argv[2];
const PB = "http://127.0.0.1:8090";
const BASE = "http://127.0.0.1:5173";
const json = { "content-type": "application/json" };
const email = `m-${Date.now()}@example.com`;
await fetch(`${PB}/api/collections/users/records`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({ email, password: "test12345", passwordConfirm: "test12345", name: "Анастасия К.", onboarding_completed: true, degree_level: "specialist", course: 2, city: "Москва", username: `am${Date.now().toString(36)}` }),
});
const auth = await (await fetch(`${PB}/api/collections/users/auth-with-password`, { method: "POST", headers: json, body: JSON.stringify({ identity: email, password: "test12345" }) })).json();
const H = { ...json, Authorization: auth.token };
const uid = auth.record.id;
const post = async (coll, body) => (await fetch(`${PB}/api/collections/${coll}/records`, { method: "POST", headers: H, body: JSON.stringify(body) })).json();
const sems = [];
for (let i = 1; i <= 12; i++) {
  const autumn = i % 2 === 1;
  const y = 2025 + Math.floor((i - 1) / 2);
  sems.push(await post("semesters", { slug: String(i), label: `Семестр ${i}`, order: i, type: "semester", user: uid, is_current: i === 3, date_from: autumn ? `${y}-09-01` : `${y + 1}-02-01`, date_to: autumn ? `${y + 1}-01-31` : `${y + 1}-06-30` }));
}
const c1 = await post("courses", { name: "Логика", owner: uid, semester: sems[2].id, slug: "logika", cover_seed: 212 });
const c2 = await post("courses", { name: "Гражданское право", owner: uid, semester: sems[2].id, slug: "pravo", cover_seed: 20 });
const c3 = await post("courses", { name: "Маркетинг", owner: uid, semester: sems[2].id, slug: "marketing", cover_seed: 335 });
const lec = (title, c, slug) => post("lectures", { title, owner: uid, field: c.id, slug, content: "<p>x</p>" });
const l1 = await lec("Предмет и метод", c2, "predmet");
for (let i = 1; i <= 6; i++) await lec(`Лекция ${i}`, c1, `l${i}`);
const l3 = await lec("Сегментирование рынка, черновик", c3, "segm");
const del = (type, id) => fetch(`${PB}/api/trash/delete`, { method: "POST", headers: H, body: JSON.stringify({ type, id }) });
await del("lecture", l1.id);
await del("course", c1.id);
await del("lecture", l3.id);
await post("tasks", { title: "Доделать конспект по пределу", owner: uid, due: "2026-10-13" });
await post("tasks", { title: "Прочитать параграф 4", owner: uid, due: "2026-10-14" });
await post("tasks", { title: "Пройти квиз", owner: uid, due: "2026-10-19" });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', email);
await p.fill('input[type="password"]', "test12345");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
for (const [name, path] of [["profile", "/profile"], ["more", "/more"], ["trash", "/trash"], ["periods", "/settings/periods"], ["settings", "/settings"], ["register", "/register"]]) {
  if (name === "register") continue;
  await p.goto(BASE + path);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/mob-${name}-390.png` });
}
// шторка выбора уровня
await p.goto(`${BASE}/settings`);
await p.waitForSelector(".c-erow");
await p.click('.c-erow:has-text("Уровень и курс") .act');
await p.click(".c-pick-btn >> nth=0");
await p.waitForSelector(".c-pick-list");
await p.screenshot({ path: `${OUT}/mob-sheet-390.png` });
// строка в режиме правки
await p.keyboard.press("Escape");
await p.click('.c-erow.editing >> text=Отмена');
await p.click('.c-erow:has-text("Имя пользователя") .act');
await p.screenshot({ path: `${OUT}/mob-edit-390.png` });
// период
await p.goto(`${BASE}/settings/periods`);
await p.waitForSelector(".c-m-list");
await p.click(".c-m-list button >> nth=2");
await p.waitForSelector(".c-sheet-dialog");
await p.screenshot({ path: `${OUT}/mob-period-sheet-390.png` });
// профиль в режиме «Группа»
await p.evaluate(() => localStorage.setItem("cohorta:mode", "group"));
await p.goto(`${BASE}/profile`);
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/mob-profile-group-390.png` });
await b.close();
console.log("done", email);
