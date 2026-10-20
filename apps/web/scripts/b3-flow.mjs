// B3 v2: сквозная проверка и скриншоты на одноразовом пользователе.
// node scripts/b3-flow.mjs <папка скриншотов>
// Создаёт пользователя (регистрация + онбординг), заводит 4 предмета, расписание, лекции и задачи
// как на макетах, снимает все экраны волны на 1440 и 390, проверяет формы
// (предмет, пара с занятой клеткой, колода) и переходы, затем удаляет пользователя и его записи.
import { chromium } from "playwright";

const OUT = process.argv[2];
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB ?? "http://127.0.0.1:8090";
let failed = 0;
const check = (ok, msg) => {
  console.log(ok ? "ok  " : "FAIL", msg);
  if (!ok) failed += 1;
};

async function onboard(p, email) {
  await p.goto(`${BASE}/register`);
  await p.fill('input[type="email"]', email);
  const pw = p.locator('input[type="password"]');
  await pw.nth(0).fill("test12345");
  await pw.nth(1).fill("test12345");
  await p.click('button[type="submit"]');
  await p.waitForURL(/onboarding/, { timeout: 15000 });
  await p.waitForSelector(".c-onb-card");
  await p.fill(".c-onb-body input[type=text], .c-onb-body input:not([type])", "Анастасия Кузнецова");
  await p.click(".c-onb-nav .primary");
  await p.waitForSelector(".c-onb-combo");
  await p.fill(".c-onb-combo input", "Москва");
  await p.waitForTimeout(500);
  await p.click(".c-onb-sugg button");
  await p.waitForSelector(".c-onb-unis");
  await p.click(".c-onb-unis button >> nth=0");
  await p.click(".c-onb-nav .primary");
  await p.click("text=Специалитет");
  await p.click('.c-onb-round[aria-label="2 курс"]');
  await p.click(".c-onb-nav .primary");
  await p.waitForSelector(".c-onb-plist");
  await p.click(".c-onb-nav .primary");
  await p.waitForURL(/\/s\//, { timeout: 30000 });
  await p.waitForTimeout(1500);
}

async function seed(p) {
  return p.evaluate(async (pb) => {
    const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
    const h = { "Content-Type": "application/json", Authorization: auth.token };
    const uid = auth.record?.id;
    const api = async (path, method = "GET", body) => {
      const r = await fetch(`${pb}/api/collections/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
      return j;
    };
    const sems = (await api("semesters/records?perPage=50&sort=order")).items;
    const cur = sems.find((s) => s.is_current) ?? sems[0];
    const mk = async (name, slug, seed) =>
      (await api("courses/records", "POST", { name, slug, semesters: cur.id, owner: uid, cover_seed: seed }));
    const civ = await mk("Гражданское право", "civil-law", 20);
    const mkt = await mk("Маркетинг", "marketing", 335);
    const stat = await mk("Статистика", "statistics", 135);
    const phil = await mk("Философия", "philosophy", 212);

    const pair_times = [
      { n: 1, start: "09:00", end: "10:30" }, { n: 2, start: "10:40", end: "12:10" },
      { n: 3, start: "12:40", end: "14:10" }, { n: 4, start: "14:20", end: "15:50" },
      { n: 5, start: "16:00", end: "17:30" },
    ];
    const d = new Date();
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    const ds = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const settings = { owner: uid, pair_times, odd_week_anchor: ds(monday), show_saturday: true };
    const have = (await api(`schedule_settings/records?filter=${encodeURIComponent(`owner="${uid}"`)}`)).items[0];
    if (have) await api(`schedule_settings/records/${have.id}`, "PATCH", settings);
    else await api("schedule_settings/records", "POST", settings);
    const S = async (c, weekday, pair_number, kind, room, parity = "any") =>
      api("schedule_slots/records", "POST", { owner: uid, semester: cur.id, subject: c.id, weekday, pair_number, week_parity: parity, kind, room });
    const s1 = await S(stat, 1, 1, "lecture", "412");
    await S(mkt, 1, 2, "seminar", "301");
    await S(mkt, 2, 1, "lecture", "208");
    await S(civ, 2, 3, "seminar", "117");
    await S(phil, 3, 2, "lecture", "301");
    const s6 = await S(civ, 4, 1, "lecture", "214");
    await S(stat, 4, 4, "seminar", "412");
    await S(phil, 5, 2, "seminar", "301");
    await S(civ, 5, 3, "lecture", "208");
    await S(mkt, 5, 4, "lecture", "117");
    await S(stat, 6, 3, "lab", "3", "odd");
    // две пары недели с конспектом (градиент)
    const L = async (c, title, slug, number, slot, date) =>
      api("lectures/records", "POST", { title, slug, content: "<p>Текст конспекта.</p>", field: c.id, owner: uid, number, slot: slot.id, lecture_date: date });
    await L(stat, "Лекция 1", "stat-1", 1, s1, ds(monday));
    await L(civ, "Лекция 6", "civ-6", 6, s6, ds(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3)));
    const t = (n) => ds(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
    const T = (title, subject, due, extra = {}) =>
      api("tasks/records", "POST", { owner: uid, title, subject: subject?.id, due, source: "manual", ...extra });
    await T("Доделать конспект по пределу последовательности", stat, t(-7));
    await T("Прочитать параграф про Крещение Руси", phil, t(-5));
    await T("Пройти квиз по пределу", stat, t(0));
    await T("Сдать билеты на проверку", phil, t(0));
    await T("Домашка по маркетингу", mkt, t(0), { done_at: t(0) });
    await T("Реферат по философии", phil, t(5));
    return { uid, token: auth.token, sem: cur.slug, semId: cur.id, courses: [civ.id, mkt.id, stat.id, phil.id] };
  }, PB);
}

const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const phone = w < 500;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  const email = `b3-${w}-${Date.now()}@example.com`;
  await onboard(p, email);
  const info = await seed(p);
  const shot = (name) => p.screenshot({ path: `${OUT}/${name}-${w}.png` });
  console.log(`--- ${w}px, семестр ${info.sem}`);

  // Расписание
  await p.goto(`${BASE}/schedule`);
  await p.waitForTimeout(1500);
  await shot("schedule");
  // Форма новой пары из пустой клетки (десктоп) / кнопкой «Добавить» через ?add=1
  await p.goto(`${BASE}/schedule?add=1`);
  await p.waitForTimeout(800);
  const dlg = p.locator(".c-dialog");
  check(await dlg.isVisible(), `${w}: форма пары открывается`);
  await shot("form-pair-new");
  // занятая клетка: Пн, 1 пара, «Каждая» — там уже Статистика
  await p.getByRole("radio", { name: "Пн" }).click();
  await p.getByRole("radio", { name: "Каждая" }).click();
  await p.waitForTimeout(200);
  const err = await p.locator(".c-form-err").first().textContent().catch(() => "");
  check(/уже есть пара «Статистика»/.test(err ?? ""), `${w}: занятая клетка показывает «${err}»`);
  await shot("form-pair-conflict");
  await p.getByRole("button", { name: "Сохранить" }).click();
  await p.waitForTimeout(400);
  check(await dlg.isVisible(), `${w}: при конфликте окно не закрывается и пара не сохраняется`);
  p.on("response", (r) => { if (r.request().method() !== "GET" && r.url().includes("schedule_slots")) console.log("   ", r.request().method(), r.status(), r.url().slice(-60)); });
  p.on("console", (m) => { if (m.type() === "error") console.log("   console:", m.text().slice(0, 200)); });
  // свободная клетка: Ср, 3 пара → сохраняется по Enter в поле «Аудитория»
  await p.getByRole("radio", { name: "Ср" }).click();
  await p.locator(".c-form select").nth(1).selectOption("3");
  await p.getByLabel("Аудитория").fill("999");
  await p.getByLabel("Аудитория").press("Enter");
  await p.waitForTimeout(1200);
  const stillOpen = await dlg.isVisible();
  if (stillOpen) console.log("   окно:", (await dlg.innerText()).replace(/\s+/g, " ").slice(0, 400));
  check(!stillOpen, `${w}: Enter сохраняет форму пары`);

  // Задачи
  await p.goto(`${BASE}/tasks`);
  await p.waitForTimeout(1500);
  await shot("tasks");

  // Пары предмета
  await p.goto(`${BASE}/s/${info.sem}/civil-law/pairs`);
  await p.waitForTimeout(1500);
  await shot("subject-pairs");

  // Новый предмет: пустое название → подсказка; с названием → Enter → страница предмета, обложка есть
  await p.goto(`${BASE}/s/${info.sem}/lectures`);
  await p.waitForTimeout(1000);
  if (phone) {
    await p.getByRole("radio", { name: "Предметы" }).click();
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: /Новый предмет/ }).first().click();
  } else {
    await p.getByLabel("Добавить предмет").click();
  }
  await p.waitForTimeout(500);
  await shot("form-subject");
  const focused = await p.evaluate(() => document.activeElement?.tagName);
  check(focused === "INPUT", `${w}: курсор сразу в поле «Название» (${focused})`);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(300);
  check(/Введи название предмета/.test(await p.locator(".c-dialog").innerText()), `${w}: пустое название — подсказка`);
  await shot("form-subject-empty");
  await p.keyboard.type("Теория вероятностей");
  await p.keyboard.press("Enter");
  await p.waitForURL(/theoriya|teoriya|teoriia|teorija|probab|\/s\/[^/]+\/[^/]+$/, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  check(!/\/lectures$/.test(p.url()) && !/courses$/.test(p.url()), `${w}: после «Создать» открылась страница предмета (${p.url()})`);
  const seedOfNew = await p.evaluate(async ({ pb, token }) => {
    const r = await fetch(`${pb}/api/collections/courses/records?perPage=50&filter=${encodeURIComponent('name="Теория вероятностей"')}`, { headers: { Authorization: token } });
    return (await r.json()).items?.[0]?.cover_seed;
  }, { pb: PB, token: info.token });
  check(seedOfNew === 158 * 0 + Math.round((20 + 4 * 137.5) % 360), `${w}: у нового предмета cover_seed = ${seedOfNew} (пятый по счёту → 210)`);

  // Колода (десктоп)
  if (!phone) {
    await p.goto(`${BASE}/decks`);
    await p.waitForTimeout(1000);
    await p.getByRole("button", { name: /Новая колода/ }).click();
    await p.waitForTimeout(400);
    await shot("form-deck");
    await p.keyboard.type("Сделки и договоры");
    await p.keyboard.press("Enter");
    await p.waitForURL(/\/decks\/[^/]+$/, { timeout: 8000 }).catch(() => {});
    check(/\/decks\/(?!new)[^/]+$/.test(p.url()), `${w}: «Создать» колоду открывает колоду (${p.url()})`);
  }

  // Периоды учёбы
  await p.goto(`${BASE}/settings/periods`);
  await p.waitForTimeout(1200);
  await shot("settings-periods");

  // Уборка: предметы и пользователь (сначала записи с owner — иначе «сиротами» видны всем)
  const del = await p.evaluate(async ({ pb, token, uid }) => {
    const h = { Authorization: token };
    for (const coll of ["tasks", "schedule_slot_lectures", "lectures", "schedule_slots", "schedule_settings", "decks", "courses"]) {
      const r = await fetch(`${pb}/api/collections/${coll}/records?perPage=200&fields=id`, { headers: h });
      const items = (await r.json()).items ?? [];
      for (const it of items) await fetch(`${pb}/api/collections/${coll}/records/${it.id}`, { method: "DELETE", headers: h });
    }
    const r = await fetch(`${pb}/api/collections/users/records/${uid}`, { method: "DELETE", headers: h });
    return r.status;
  }, { pb: PB, token: info.token, uid: info.uid });
  console.log(w, "удаление пользователя:", del);
  await ctx.close();
}
await b.close();
console.log(failed ? `ПРОВАЛЕНО: ${failed}` : "ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ");
process.exit(failed ? 1 : 0);
