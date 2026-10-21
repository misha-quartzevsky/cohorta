// Ручная проверка группы на двух аккаунтах (волна C, этап 2), в настоящем браузере.
//   PB_URL=http://127.0.0.1:8092 SUPER_EMAIL=… SUPER_PASS=… BASE=http://127.0.0.1:5174 node scripts/c-two-accounts.mjs [папка для снимков]
// Создаёт двух одноразовых людей и группу, в конце всё удаляет. Выводит ПРОШЛО / НЕ ПРОШЛО по пунктам.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:5174";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8092";
const OUT = process.argv[2];
const PASS = "Test-pass-12345";
const stamp = Date.now();
const sem = "demo";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "ПРОШЛО   " : "НЕ ПРОШЛО"}  ${name}${extra ? `  [${extra}]` : ""}`);
};

async function api(method, url, token, body) {
  const r = await fetch(PB + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { status: r.status, json };
}
async function person(tag) {
  const email = `two-${tag}-${stamp}@example.test`;
  const c = await api("POST", "/api/collections/users/records", null, { email, password: PASS, passwordConfirm: PASS, name: `Проверка ${tag}` });
  const a = await api("POST", "/api/collections/users/auth-with-password", null, { identity: email, password: PASS });
  await api("PATCH", `/api/collections/users/records/${a.json.record.id}`, a.json.token, { onboarding_completed: true });
  return { email, id: a.json.record.id, token: a.json.token, name: `Проверка ${tag}`, created: c.status };
}

const su = (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS })).json.token;
const A = await person("A");
const B = await person("B");
const gname = `ПроверкаГр-${stamp}`;
const group = (await api("POST", "/api/groups/create", A.token, { name: gname })).json.id;
await api("POST", `/api/groups/${group}/invite/enable`, A.token, { enabled: true });
const code = (await api("GET", `/api/groups/${group}/invite`, A.token)).json.code;
const slug = `two-${stamp}`;
const title = `Альфа ${stamp}`;
const lecture = (await api("POST", "/api/collections/lectures/records", A.token, { title, slug, owner: A.id, content: "<p>СЕКРЕТ-ТЕКСТ-ЛЕКЦИИ</p>" })).json.id;

const browser = await chromium.launch();
async function open(who, w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', who.email);
  await p.fill('input[type="password"]', PASS);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(3000); // у нового человека нет семестра: вход ведёт на «/», а не на /s/…
  return { ctx, p };
}
const shot = async (p, name) => OUT && (await p.screenshot({ path: `${OUT}/two-${name}.png` }));
const bodyText = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

try {
  const a = await open(A);
  const b = await open(B);

  // 1. Вступление по коду ничего не открывает
  await b.p.goto(`${BASE}/join/${code}`);
  await b.p.waitForTimeout(1500);
  await b.p.getByRole("button", { name: /Вступить/ }).first().click();
  await b.p.waitForURL(/\/group/, { timeout: 15000 });
  await b.p.waitForTimeout(1500);
  check("B вступил по коду и видит группу", (await bodyText(b.p)).includes(gname));
  const lec404 = await api("GET", `/api/collections/lectures/records/${lecture}`, B.token);
  check("вступление не открывает лекцию (API 404)", lec404.status === 404, String(lec404.status));
  const prev = await api("GET", `/api/collections/lecture_previews/records?filter=${encodeURIComponent(`lecture="${lecture}"`)}`, B.token);
  check("вступление не открывает даже название (предпросмотр выключен)", (prev.json.items ?? []).length === 0);
  await b.p.goto(`${BASE}/s/${sem}/group/people/${A.id}`);
  await b.p.waitForTimeout(1500);
  const personText = await bodyText(b.p);
  check("у A на странице B «Лекции скрыты»/нет названия лекции", !personText.includes(title));
  await b.p.goto(`${BASE}/s/${sem}/group/lecture/${lecture}`);
  await b.p.waitForTimeout(1500);
  const closedText = await bodyText(b.p);
  check("чужая лекция без доступа: текста нет, сказано «недоступна»", !closedText.includes("СЕКРЕТ-ТЕКСТ") && closedText.includes("недоступна"));
  await shot(b.p, "b-closed");

  // 2. Код приглашения не виден участнику
  const gRec = await api("GET", `/api/collections/groups/records/${group}`, B.token);
  check("код приглашения не приходит участнику (запись группы)", gRec.status === 200 && !("invite_code" in gRec.json));
  const inv = await api("GET", `/api/groups/${group}/invite`, B.token);
  check("маршрут кода отказывает участнику", inv.status === 403, String(inv.status));
  await b.p.goto(`${BASE}/s/${sem}/group/settings`);
  await b.p.waitForTimeout(1500);
  const setText = await bodyText(b.p);
  check("в настройках группы у участника кода и ссылки нет", !setText.includes(code.toUpperCase()) && !setText.toLowerCase().includes("cohorta.ru/join"));
  await b.p.goto(`${BASE}/s/${sem}/group`);
  await b.p.waitForTimeout(1200);
  check("у участника нет кнопки «Пригласить»", (await b.p.getByRole("button", { name: "Пригласить" }).count()) === 0);
  await shot(b.p, "b-settings");

  // 3. A открывает доступ через окно «Доступ к лекции»
  await a.p.goto(`${BASE}/note/${slug}`);
  await a.p.waitForTimeout(2500);
  await a.p.getByRole("button", { name: "Меню лекции" }).first().click();
  await a.p.getByText("Доступ в группе").first().click();
  await a.p.waitForTimeout(800);
  await a.p.getByRole("button", { name: /Добавить человека или подгруппу/ }).click();
  await a.p.getByRole("button", { name: B.name }).click();
  await a.p.waitForTimeout(1200);
  const dlg = await bodyText(a.p);
  check("B появился в списке «Кто читает лекцию»", dlg.includes(B.name) && dlg.includes("Можно копировать"));
  const defaultOff = await a.p.locator(".c-gr-copy input").first().isChecked();
  check("«Можно копировать» по умолчанию выключена", defaultOff === false);
  await shot(a.p, "a-access");

  const seen = await api("GET", `/api/collections/lectures/records/${lecture}`, B.token);
  check("после выдачи B читает лекцию (API 200)", seen.status === 200);
  await b.p.goto(`${BASE}/s/${sem}/group/lecture/${lecture}`);
  await b.p.waitForTimeout(2000);
  check("после выдачи B видит текст лекции", (await bodyText(b.p)).includes("СЕКРЕТ-ТЕКСТ-ЛЕКЦИИ"));
  check("без галочки кнопки копирования у B нет", (await b.p.getByRole("button", { name: "Добавить в мои конспекты" }).count()) === 0);
  await shot(b.p, "b-open");

  // 4. Галочка включает и выключает кнопку
  await a.p.locator(".c-gr-copy").first().click();
  await a.p.waitForTimeout(1000);
  await b.p.reload();
  await b.p.waitForTimeout(2000);
  check("галочка включена: у B появилась «Добавить в мои конспекты»", (await b.p.getByRole("button", { name: "Добавить в мои конспекты" }).count()) === 1);
  await shot(b.p, "b-copy-on");
  await a.p.locator(".c-gr-copy").first().click();
  await a.p.waitForTimeout(1000);
  await b.p.reload();
  await b.p.waitForTimeout(2000);
  check("галочка снята: кнопка у B пропала", (await b.p.getByRole("button", { name: "Добавить в мои конспекты" }).count()) === 0);

  // 5. Снятие доступа
  await a.p.getByRole("button", { name: "Убрать" }).first().click();
  await a.p.waitForTimeout(1200);
  const gone = await api("GET", `/api/collections/lectures/records/${lecture}`, B.token);
  check("после снятия доступа B снова не видит лекцию (API 404)", gone.status === 404, String(gone.status));
  await b.p.reload();
  await b.p.waitForTimeout(1800);
  const afterText = await bodyText(b.p);
  check("после снятия в окне B текста нет", !afterText.includes("СЕКРЕТ-ТЕКСТ"));

  // 6. Лекция в корзине пропадает сразу
  await api("POST", "/api/collections/lecture_shares/records", A.token, { lecture, owner: A.id, grantee: B.id, group });
  check("после повторной выдачи B снова читает", (await api("GET", `/api/collections/lectures/records/${lecture}`, B.token)).status === 200);
  const trashed = await api("POST", "/api/trash/delete", A.token, { type: "lecture", id: lecture });
  check("лекция A ушла в корзину", trashed.status === 200, String(trashed.status));
  check("в корзине лекция сразу пропала у B (API 404)", (await api("GET", `/api/collections/lectures/records/${lecture}`, B.token)).status === 404);
  await b.p.goto(`${BASE}/s/${sem}/group/lecture/${lecture}`);
  await b.p.waitForTimeout(1800);
  check("в корзине у B на экране текста нет", !(await bodyText(b.p)).includes("СЕКРЕТ-ТЕКСТ"));
  await api("POST", "/api/trash/restore", A.token, { type: "lecture", id: lecture });
  check("после восстановления B снова читает", (await api("GET", `/api/collections/lectures/records/${lecture}`, B.token)).status === 200);

  // 7. Владелец не выйдет без передачи
  const leave = await api("POST", `/api/groups/${group}/leave`, A.token, { remember: false });
  check("владелец с участниками получает отказ при выходе (409)", leave.status === 409, String(leave.status));
  await a.p.goto(`${BASE}/s/${sem}/group/settings`);
  await a.p.waitForTimeout(1500);
  await a.p.getByRole("button", { name: "Выйти из группы" }).first().click();
  await a.p.waitForTimeout(800);
  const leaveText = await bodyText(a.p);
  check("в окне выхода владельцу сказано «Передай группу»", leaveText.includes("Передай группу"));
  await shot(a.p, "a-leave");
  const stillThere = (await api("GET", `/api/collections/groups/records/${group}`, A.token)).status === 200;
  check("владелец остался в группе", stillThere);
} catch (e) {
  console.log("СБОЙ СКРИПТА:", String(e).slice(0, 400));
  results.push(false);
} finally {
  await browser.close();
  // уборка
  await api("DELETE", `/api/collections/groups/records/${group}`, su);
  for (const u of [A, B]) await api("DELETE", `/api/collections/users/records/${u.id}`, su);
}
const bad = results.filter((x) => !x).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length} прошло.`);
process.exit(bad ? 1 : 0);
