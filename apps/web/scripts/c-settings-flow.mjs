// Руками в браузере: форма «Новая группа» с кодом, шестерёнка настроек, переименование, сброс кода, выход из группы
// (владелец и участник). Песочница 8092 с c-seed.mjs, приложение на 5174. Меняет данные песочницы.
//   PB_URL=http://127.0.0.1:8092 SUPER_EMAIL=… SUPER_PASS=… node scripts/c-settings-flow.mjs <папка для снимков>
import { chromium } from "playwright";

const OUT = process.argv[2];
const BASE = process.env.BASE ?? "http://127.0.0.1:5174";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8092";
const PASS = "Test-pass-12345";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "ПРОШЛО   " : "НЕ ПРОШЛО"}  ${name}${extra ? `  [${extra}]` : ""}`);
};
async function api(method, url, token, body) {
  const r = await fetch(PB + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  return { status: r.status, json };
}
const stamp = Date.now();
async function person(tag) {
  const email = `st-${tag}-${stamp}@example.test`;
  await api("POST", "/api/collections/users/records", null, { email, password: PASS, passwordConfirm: PASS, name: `Проверка ${tag}` });
  const a = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: email, password: PASS })).json;
  await api("PATCH", `/api/collections/users/records/${a.record.id}`, a.token, { onboarding_completed: true });
  return { email, id: a.record.id, token: a.token, name: `Проверка ${tag}` };
}
const su = (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS })).json.token;
const A = await person("A");
const B = await person("B");
const browser = await chromium.launch();
async function open(who, w = 1440, h = 900, group = "") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', who.email);
  await p.fill('input[type="password"]', PASS);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(3000);
  await p.evaluate((g) => { localStorage.setItem("cohorta:mode", "group"); if (g) localStorage.setItem("cohorta:group", g); }, group);
  return { ctx, p };
}
const text = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const shot = (p, name) => OUT && p.screenshot({ path: `${OUT}/${name}.png` });
const FORMAT = /\b[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}\b/;

let groupId = "";
try {
  // ---------- форма «Новая группа» ----------
  const a = await open(A);
  await a.ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  await a.p.goto(`${BASE}/s/demo/group/new`);
  await a.p.waitForTimeout(1500);
  const shownCode = (await a.p.locator(".c-gr-codebox").innerText()).trim();
  check("в форме сразу показан код вида XXXX-XXXX без путаемых знаков", FORMAT.test(shownCode), shownCode);
  await a.p.fill("#gr-name", "МК-31");
  await shot(a.p, "create-1440");
  await a.p.getByRole("button", { name: "Скопировать" }).click();
  await a.p.waitForTimeout(300);
  check("после «Скопировать» на кнопке «Скопировано»", (await a.p.getByRole("button", { name: "Скопировано" }).count()) === 1);
  const clip = await a.p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check("в буфере именно показанный код", clip === shownCode, clip);
  await a.p.waitForTimeout(1200);
  check("через секунду кнопка снова «Скопировать»", (await a.p.getByRole("button", { name: "Скопировать" }).count()) === 1);
  await a.p.getByRole("button", { name: "Создать группу" }).click();
  await a.p.waitForURL(/\/group(\?|$)/, { timeout: 15000 });
  await a.p.waitForTimeout(1500);
  const mine = (await api("GET", `/api/collections/group_members/records?expand=group&filter=${encodeURIComponent(`user="${A.id}"`)}`, A.token)).json.items;
  groupId = mine[0].group;
  const stored = (await api("GET", `/api/groups/${groupId}/invite`, A.token)).json.code;
  check("после «Создать группу» код группы совпадает с показанным в форме", stored.toUpperCase() === shownCode.replace("-", ""), stored);

  // ---------- шестерёнка у владельца ----------
  await B.token; // ссылка включается, B вступает по коду, чтобы в группе было с кем передавать владение
  await api("POST", `/api/groups/${groupId}/invite/enable`, A.token, { enabled: true });
  const joined = await api("POST", "/api/groups/join", B.token, { code: shownCode });
  check("участник вступает по коду с дефисом и в верхнем регистре", joined.status === 200, String(joined.status));
  await a.p.goto(`${BASE}/s/demo/group`);
  await a.p.waitForTimeout(1800);
  const gear = a.p.locator(".c-gr-gear-d");
  const inv = a.p.getByRole("button", { name: "Пригласить" });
  const gb = await gear.boundingBox();
  const ib = await inv.first().boundingBox();
  check("у владельца в шапке шестерёнка 44×44 левее «Пригласить»", gb && ib && Math.round(gb.width) === 44 && Math.round(gb.height) === 44 && gb.x + gb.width < ib.x, `gear ${gb?.x},${gb?.width} invite ${ib?.x}`);
  await shot(a.p, "home-1440");
  await gear.click();
  await a.p.waitForURL(/\/group\/settings$/);
  await a.p.waitForTimeout(1200);
  const st = await text(a.p);
  check("шестерёнка открывает настройки владельца со ссылкой-приглашением", st.includes("Настройки группы") && st.includes("Ссылка-приглашение") && st.includes("cohorta.ru/join/"));
  await shot(a.p, "settings-1440");
  check("в настройках путь обратно: крошка «МК-31»", (await a.p.locator(".c-gr-crumbs a", { hasText: "МК-31" }).count()) === 1);

  // переименовать
  await a.p.getByRole("button", { name: "Изменить" }).first().click();
  await a.p.waitForTimeout(400);
  const nameInput = a.p.locator(".c-gr-set input").first();
  await nameInput.fill("МК-32");
  await a.p.getByRole("button", { name: "Сохранить" }).first().click();
  await a.p.waitForTimeout(1500);
  const renamed = (await api("GET", `/api/collections/groups/records/${groupId}`, A.token)).json.name;
  check("переименование сохранилось", renamed === "МК-32", renamed);

  // сбросить код
  const before = (await api("GET", `/api/groups/${groupId}/invite`, A.token)).json.code;
  await a.p.getByRole("button", { name: "Сбросить код" }).first().click();
  await a.p.waitForTimeout(500);
  await a.p.locator(".c-dialog").getByRole("button", { name: "Сбросить" }).click();
  await a.p.waitForTimeout(1500);
  const after = (await api("GET", `/api/groups/${groupId}/invite`, A.token)).json.code;
  check("сброс выдал новый код того же формата", after !== before && /^[2-9a-hjkmnp-z]{8}$/.test(after), `${before} → ${after}`);
  const X = await person("X");
  check("старый код после сброса не работает", (await api("POST", "/api/groups/join", X.token, { code: before })).status === 404);
  check("новый код работает", (await api("POST", "/api/groups/join", X.token, { code: after.toUpperCase() })).status === 200);

  // ---------- участник: шестерёнка, настройки без ссылки, выход ----------
  const b = await open(B, 1440, 900, groupId);
  await b.p.goto(`${BASE}/s/demo/group`);
  await b.p.waitForTimeout(1800);
  check("у участника «Пригласить» нет, шестерёнка есть", (await b.p.getByRole("button", { name: "Пригласить" }).count()) === 0 && (await b.p.locator(".c-gr-gear-d").count()) === 1);
  await shot(b.p, "home-member-1440");
  await b.p.locator(".c-gr-gear-d").click();
  await b.p.waitForURL(/\/group\/settings$/);
  await b.p.waitForTimeout(1200);
  const mt = await text(b.p);
  check("настройки участника: ссылки и кода нет, сказано, что её видит владелец", !mt.includes("cohorta.ru/join/") && !mt.includes(after.toUpperCase()) && mt.includes("Ссылку видит и сбрасывает только владелец"));
  check("у участника нет «Сбросить код» и переключателя ссылки", (await b.p.getByRole("button", { name: "Сбросить код" }).count()) === 0);
  await shot(b.p, "settings-member-1440");
  await b.p.getByRole("button", { name: "Выйти из группы" }).first().click();
  await b.p.waitForTimeout(600);
  await b.p.locator(".c-dialog").getByRole("button", { name: "Выйти из группы" }).click();
  await b.p.waitForTimeout(2000);
  const memB = (await api("GET", `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}" && user="${B.id}"`)}`, B.token)).json.items;
  check("участник вышел из группы", memB.length === 0);

  // ---------- владелец выходит с передачей ----------
  await a.p.goto(`${BASE}/s/demo/group/settings`);
  await a.p.waitForTimeout(1500);
  await a.p.getByRole("button", { name: "Выйти из группы" }).first().click();
  await a.p.waitForTimeout(600);
  check("владельцу при выходе предлагается «Передай группу»", (await text(a.p)).includes("Передай группу"));
  await shot(a.p, "settings-transfer-1440");
  await a.p.locator(".c-dialog").getByRole("button", { name: /Передать и выйти/ }).click();
  await a.p.waitForTimeout(2000);
  const g2 = (await api("GET", `/api/collections/groups/records/${groupId}`, A.token)).status;
  check("после передачи прежний владелец вышел из группы", g2 === 404 || g2 === 403, String(g2));

  // ---------- телефон ----------
  const demo = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: "asyaobraz17@gmail.com", password: "12345678" })).json;
  const mk = (await api("GET", `/api/collections/groups/records?filter=${encodeURIComponent('name="МК-31"')}`, demo.token)).json.items[0]?.id;
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/login`);
  await mp.fill('input[type="email"]', "asyaobraz17@gmail.com");
  await mp.fill('input[type="password"]', "12345678");
  await mp.click('button[type="submit"]');
  await mp.waitForURL(/\/s\//, { timeout: 20000 });
  await mp.evaluate((g) => { localStorage.setItem("cohorta:mode", "group"); localStorage.setItem("cohorta:group", g); }, mk);
  await mp.goto(`${BASE}/s/demo/group`);
  await mp.waitForTimeout(1800);
  await shot(mp, "people-390");
  const hb = await mp.locator(".c-gr-mhead .btns button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check("телефон: в шапке шестерёнка левее «+» и лупы", JSON.stringify(hb) === JSON.stringify(["Настройки группы", "Пригласить", "Поиск"]), hb.join(" | "));
  await mp.getByRole("button", { name: "Настройки группы" }).click();
  await mp.waitForURL(/\/group\/settings$/);
  await mp.waitForTimeout(1200);
  await shot(mp, "settings-390");
  check("телефон: в настройках «‹ Люди» ведёт обратно в группу", (await mp.locator("a.c-gx-back", { hasText: "Люди" }).count()) === 1);
  await mp.locator("a.c-gx-back", { hasText: "Люди" }).click();
  await mp.waitForURL(/\/group$/);
  check("телефон: возврат на главную группы", true);
  await m.close();
  await shot(a.p, "settings-owner-after");
} catch (e) {
  console.log("СБОЙ СКРИПТА:", String(e).slice(0, 500));
  results.push(false);
}
await browser.close();
if (groupId) await api("DELETE", `/api/collections/groups/records/${groupId}`, su);
for (const u of (await api("GET", `/api/collections/users/records?filter=${encodeURIComponent('email ~ "st-"')}&perPage=50`, su)).json.items ?? []) await api("DELETE", `/api/collections/users/records/${u.id}`, su);
const bad = results.filter((x) => !x).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length} прошло.`);
process.exit(bad ? 1 : 0);
