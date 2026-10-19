// Проверка руками: правка в строке, периоды, корзина, удаление аккаунта (на одноразовом пользователе).
// node scripts/b6-settings-flow.mjs <папка для скриншотов>
import { chromium } from "playwright";

const OUT = process.argv[2];
const PB = "http://127.0.0.1:8090";
const BASE = "http://127.0.0.1:5173";
const json = { "content-type": "application/json" };
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));

const email = `set-${Date.now()}@example.com`;
await fetch(`${PB}/api/collections/users/records`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({ email, password: "test12345", passwordConfirm: "test12345", name: "Анастасия К.", onboarding_completed: true, degree_level: "specialist", course: 2, city: "Москва" }),
});
const auth = await (await fetch(`${PB}/api/collections/users/auth-with-password`, { method: "POST", headers: json, body: JSON.stringify({ identity: email, password: "test12345" }) })).json();
const H = { ...json, Authorization: auth.token };
const uid = auth.record.id;
const post = async (coll, body) => (await fetch(`${PB}/api/collections/${coll}/records`, { method: "POST", headers: H, body: JSON.stringify(body) })).json();

const sems = [];
for (let i = 1; i <= 4; i++) {
  const autumn = i % 2 === 1;
  const y = 2025 + Math.floor((i - 1) / 2);
  sems.push(await post("semesters", { slug: String(i), label: `Семестр ${i}`, order: i, type: "semester", user: uid, is_current: i === 3, date_from: autumn ? `${y}-09-01` : `${y + 1}-02-01`, date_to: autumn ? `${y + 1}-01-31` : `${y + 1}-06-30` }));
}
const c1 = await post("courses", { name: "Логика", owner: uid, semester: sems[0].id, slug: "logika", cover_seed: 212 });
const c2 = await post("courses", { name: "Маркетинг", owner: uid, semester: sems[0].id, slug: "marketing", cover_seed: 335 });
const l1 = await post("lectures", { title: "Предмет и метод", owner: uid, field: c2.id, slug: "predmet-i-metod", content: "<p>x</p>" });
await post("lectures", { title: "Силлогизмы", owner: uid, field: c1.id, slug: "sillogizmy", content: "<p>y</p>" });
await post("lectures", { title: "Законы мышления", owner: uid, field: c1.id, slug: "zakony", content: "<p>z</p>" });

await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', email);
await p.fill('input[type="password"]', "test12345");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });

// 1. правка в строке
await p.goto(`${BASE}/settings`);
await p.waitForSelector(".c-erow");
await p.click('.c-erow:has-text("Имя пользователя") .act');
await p.fill(".c-erow.editing input", "A!");
await p.click(".c-erow.editing .primary");
console.log("1 validation:", (await p.textContent(".c-erow.editing small")).trim());
const handle = `ana${Date.now().toString(36)}`;
await p.fill(".c-erow.editing input", handle);
await p.screenshot({ path: `${OUT}/st-edit-1440.png` });
await p.click(".c-erow.editing .primary");
await p.waitForSelector('.c-erow:has-text("Сохранено")');
console.log("1 saved:", (await p.textContent('.c-erow:has-text("Имя пользователя") .val')).trim());
await p.click('.c-erow:has-text("Уровень и курс") .act');
await p.selectOption(".c-erow.editing select >> nth=0", "master");
await p.click(".c-erow.editing .primary");
await p.waitForSelector('.c-erow:has-text("Магистратура")');
console.log("1 degree:", (await p.textContent('.c-erow:has-text("Уровень и курс") .val')).trim());
await p.screenshot({ path: `${OUT}/st-saved-1440.png`, fullPage: true });
await p.click('.c-settings-toc button:has-text("Данные и безопасность")');
await p.waitForTimeout(900);
console.log("1 toc active:", (await p.textContent(".c-settings-toc button.on")).trim());

// 2. периоды
await p.goto(`${BASE}/settings/periods`);
await p.waitForSelector(".c-period-row");
await p.click('.c-stepper button[aria-label="Больше"]');
await p.click(".c-period-row:nth-child(1) .cur-btn", { force: true });
await p.click(".c-periods-foot .primary");
await p.waitForSelector('.c-periods-saved:has-text("Сохранено")');
await p.reload();
await p.waitForSelector(".c-period-row");
console.log("2 periods after reload:", await p.locator(".c-stepper output").textContent(), "| first is current:", await p.locator(".c-period-row:nth-child(1) .nm >> text=Сейчас").count());
await p.screenshot({ path: `${OUT}/st-periods-1440.png`, fullPage: true });

// 3. корзина
const del = (type, id) => fetch(`${PB}/api/trash/delete`, { method: "POST", headers: H, body: JSON.stringify({ type, id }) });
await del("lecture", l1.id);
await del("course", c1.id);
console.log("3 trashed lecture visible via API:", (await fetch(`${PB}/api/collections/lectures/records/${l1.id}`, { headers: H })).status);
await p.goto(`${BASE}/trash`);
await p.waitForSelector(".c-trash-row");
await p.screenshot({ path: `${OUT}/st-trash-1440.png` });
await p.click('.c-trash-row:has-text("Предмет и метод") >> text=Восстановить');
await p.waitForTimeout(900);
console.log("3 restored lecture via API:", (await fetch(`${PB}/api/collections/lectures/records/${l1.id}`, { headers: H })).status, "| rows left:", await p.locator(".c-trash-row").count());
await p.click(".c-trash-row >> text=Удалить навсегда");
await p.click(".c-delete-actions >> text=Удалить навсегда");
await p.waitForTimeout(900);
console.log("3 rows after purge:", await p.locator(".c-trash-row").count());

// 4. удаление аккаунта
await p.goto(`${BASE}/settings`);
await p.waitForSelector(".c-settings-danger");
await p.click(".c-settings-danger .c-btn");
await p.waitForSelector(".c-delete-body");
await p.screenshot({ path: `${OUT}/st-delete1-1440.png` });
await p.click(".c-delete-actions >> text=Продолжить");
await p.fill(".c-delete-body input", "удалить");
await p.screenshot({ path: `${OUT}/st-delete2-1440.png` });
await p.click(".c-delete-actions >> text=Удалить аккаунт");
await p.waitForURL(/login/, { timeout: 10000 });
await p.fill('input[type="email"]', email);
await p.fill('input[type="password"]', "test12345");
await p.click('button[type="submit"]');
await p.waitForSelector(".c-delete-pending");
console.log("4 pending screen:", (await p.textContent(".c-delete-pending h1")).trim());
await p.screenshot({ path: `${OUT}/st-delete3-1440.png` });
await p.click(".c-delete-pending >> text=Отменить удаление");
await p.waitForSelector(".c-shell", { timeout: 10000 });
console.log("4 cancelled, app is back");
await b.close();
