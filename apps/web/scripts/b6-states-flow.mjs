// Проверка руками: 404, сохранение без связи (очередь), истёкшая сессия не теряет текст.
// node scripts/b6-states-flow.mjs <папка для скриншотов>
import { chromium } from "playwright";

const OUT = process.argv[2];
const PB = "http://127.0.0.1:8090";
const BASE = "http://127.0.0.1:5173";
const json = { "content-type": "application/json" };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));

const email = `st-${Date.now()}@example.com`;
await fetch(`${PB}/api/collections/users/records`, { method: "POST", headers: json, body: JSON.stringify({ email, password: "test12345", passwordConfirm: "test12345", name: "Тест", onboarding_completed: true }) });
const auth = await (await fetch(`${PB}/api/collections/users/auth-with-password`, { method: "POST", headers: json, body: JSON.stringify({ identity: email, password: "test12345" }) })).json();
const H = { ...json, Authorization: auth.token };
const uid = auth.record.id;
const post = async (coll, body) => (await fetch(`${PB}/api/collections/${coll}/records`, { method: "POST", headers: H, body: JSON.stringify(body) })).json();
const sem = await post("semesters", { slug: "1", label: "Семестр 1", order: 1, type: "semester", user: uid, is_current: true });
const course = await post("courses", { name: "Логика", owner: uid, semester: sem.id, slug: "logika", cover_seed: 212 });
const lec = await post("lectures", { title: "Силлогизмы", owner: uid, field: course.id, slug: "sillogizmy", content: "<p>Начало</p>" });
const serverContent = async () => (await (await fetch(`${PB}/api/collections/lectures/records/${lec.id}`, { headers: H })).json()).content;

await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', email);
await p.fill('input[type="password"]', "test12345");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });

// 404
await p.goto(`${BASE}/s/1/logika/net-takoy`);
await p.waitForSelector(".c-notfound-card", { timeout: 10000 });
console.log("404 lecture:", (await p.textContent(".c-notfound h1")).trim());
await p.screenshot({ path: `${OUT}/states-404-1440.png` });
await p.goto(`${BASE}/nope/nope`);
await p.waitForSelector(".c-notfound-card");
console.log("404 route ok");

// очередь без связи
const url = `${BASE}/s/1/logika/sillogizmy/edit`;
await p.goto(url);
await p.waitForSelector(".ProseMirror");
await p.click(".ProseMirror");
await p.keyboard.press("Control+End");
await ctx.setOffline(true);
await p.keyboard.type(" ОФЛАЙН-ТЕКСТ");
await p.waitForSelector(".c-save-banner.offline", { timeout: 15000 });
console.log("offline banner:", (await p.textContent(".c-save-banner")).trim().slice(0, 40));
console.log("draft stored:", await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cohorta:draft:")).length));
await p.screenshot({ path: `${OUT}/states-offline-1440.png` });
await ctx.setOffline(false);
await p.evaluate(() => window.dispatchEvent(new Event("online")));
await p.waitForSelector(".c-save-banner.restored", { timeout: 20000 });
console.log("restored banner shown; server has text:", (await serverContent()).includes("ОФЛАЙН-ТЕКСТ"));
await p.screenshot({ path: `${OUT}/states-restored-1440.png` });
console.log("draft after sync:", await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cohorta:draft:")).length));

// сессия истекла посреди работы
await p.waitForTimeout(4000);
await p.click(".ProseMirror");
await p.keyboard.press("Control+End");
await p.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("pocketbase_auth"));
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  raw.token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: raw.record.id, exp: Math.floor(Date.now() / 1000) - 60 })}.x`;
  localStorage.setItem("pocketbase_auth", JSON.stringify(raw));
});
await p.keyboard.type(" ТЕКСТ-ПОСЛЕ-СЕССИИ");
await p.evaluate(() => window.dispatchEvent(new Event("focus")));
await p.waitForSelector(".c-session-card", { timeout: 10000 });
console.log("session modal:", (await p.textContent(".c-session-card h2")).trim());
await p.waitForTimeout(2500);
console.log("draft kept locally:", await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cohorta:draft:")).length));
await p.screenshot({ path: `${OUT}/states-session-1440.png` });
await p.click(".c-session-card .primary");
await p.waitForURL(/login/);
await p.fill('input[type="email"]', email);
await p.fill('input[type="password"]', "test12345");
await p.click('button[type="submit"]');
await p.waitForURL(/sillogizmy/, { timeout: 15000 });
console.log("returned to:", p.url().replace(BASE, ""));
await p.waitForSelector(".ProseMirror");
await p.waitForTimeout(4000);
console.log("server has post-session text:", (await serverContent()).includes("ТЕКСТ-ПОСЛЕ-СЕССИИ"));
await b.close();
