// Ссылка-приглашение у человека без аккаунта (песочница 8092, приложение 5174): /join/КОД → регистрация →
// «Вступить в группу» → онбординг. Проверяет, что вступление создалось только после нажатия и ничего не открыло.
import { chromium } from "playwright";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8092", BASE = process.env.BASE ?? "http://127.0.0.1:5174";
const api = async (m, u, t, b) => { const r = await fetch(PB + u, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const su = (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS })).json.token;
const stamp = Date.now();
const emailA = `jl-a-${stamp}@example.test`;
await api("POST", "/api/collections/users/records", null, { email: emailA, password: "Test-pass-12345", passwordConfirm: "Test-pass-12345", name: "Владелец ссылки" });
const A = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: emailA, password: "Test-pass-12345" })).json;
const group = (await api("POST", "/api/groups/create", A.token, { name: `Ссылка-${stamp}` })).json.id;
await api("POST", `/api/groups/${group}/invite/enable`, A.token, { enabled: true });
const code = (await api("GET", `/api/groups/${group}/invite`, A.token)).json.code;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
let ok = true;
const check = (n, v) => { if (!v) ok = false; console.log(v ? "ПРОШЛО   " : "НЕ ПРОШЛО", n); };
try {
  await p.goto(`${BASE}/join/${code}`);
  await p.waitForURL(/\/register/);
  const email = `jl-b-${stamp}@example.test`;
  await p.fill('input[type="email"]', email);
  const pw = p.locator('input[type="password"]');
  await pw.nth(0).fill("Test-pass-12345");
  await pw.nth(1).fill("Test-pass-12345");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/join\//, { timeout: 15000 });
  await p.waitForSelector(".c-join-group", { timeout: 8000 });
  check("после регистрации показано подтверждение с названием группы", (await p.textContent(".c-join-group")).includes(`Ссылка-${stamp}`));
  const me = (await api("POST", "/api/collections/users/auth-with-password", null, { identity: email, password: "Test-pass-12345" })).json;
  const before = await api("GET", `/api/collections/group_members/records?filter=${encodeURIComponent(`user="${me.record.id}"`)}`, me.token);
  check("до нажатия «Вступить» членства нет (автовступления нет)", before.json.totalItems === 0);
  await p.click(".c-join-actions .primary");
  await p.waitForURL(/onboarding/, { timeout: 15000 });
  const after = await api("GET", `/api/collections/group_members/records?filter=${encodeURIComponent(`user="${me.record.id}"`)}`, me.token);
  check("после нажатия членство создано", after.json.totalItems === 1);
  const flag = await p.evaluate(() => localStorage.getItem("cohorta:landInGroup"));
  check("человек идёт в онбординг, после него его откроет группа (флаг стоит)", flag === "1");
  check("вступление ничего не открыло: лекций владельца у него нет", (await api("GET", "/api/collections/lectures/records", me.token)).json.totalItems === 0);
} catch (e) { ok = false; console.log("СБОЙ:", String(e).slice(0, 300)); }
await b.close();
await api("DELETE", `/api/collections/groups/records/${group}`, su);
for (const u of (await api("GET", `/api/collections/users/records?filter=${encodeURIComponent('email ~ "jl-"')}`, su)).json.items ?? []) await api("DELETE", `/api/collections/users/records/${u.id}`, su);
process.exit(ok ? 0 : 1);
