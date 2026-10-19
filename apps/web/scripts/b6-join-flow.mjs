// Проверка руками: ссылка /join/КОД → регистрация → подтверждение → онбординг.
import { chromium } from "playwright";
const PB = "http://127.0.0.1:8090", BASE = "http://127.0.0.1:5173";
const auth = await (await fetch(`${PB}/api/collections/users/auth-with-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: "asyaobraz17@gmail.com", password: "12345678" }) })).json();
const H = { "content-type": "application/json", Authorization: auth.token };
const code = "b6test" + Date.now().toString(36);
const g = await (await fetch(`${PB}/api/collections/groups/records`, { method: "POST", headers: H, body: JSON.stringify({ name: "МК-31 тест", slug: code, owner: auth.record.id, invite_code: code }) })).json();
console.log("group", g.id ?? g);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/join/${code}`);
await p.waitForURL(/\/register/);
console.log("1 redirected to", p.url(), "stored:", await p.evaluate(() => localStorage.getItem("cohorta:pendingInvite")));
const email = `join-${Date.now()}@example.com`;
await p.fill('input[type="email"]', email);
const pw = p.locator('input[type="password"]'); await pw.nth(0).fill("test12345"); await pw.nth(1).fill("test12345");
await p.click('button[type="submit"]');
await p.waitForURL(/\/join\//, { timeout: 15000 });
p.on("console", m => console.log("console:", m.text())); p.on("response", r => r.url().includes("/api/groups") && console.log("resp", r.status(), r.url()));

await p.waitForSelector(".c-join-group", { timeout: 5000 });
console.log("2 confirm screen:", (await p.textContent(".c-join-group")).trim());
await p.screenshot({ path: process.argv[2] + "/join-1440.png" });
await p.click(".c-join-actions .primary");
await p.waitForURL(/onboarding/, { timeout: 15000 });
console.log("3 after join ->", p.url(), "landFlag:", await p.evaluate(() => localStorage.getItem("cohorta:landInGroup")), "pending:", await p.evaluate(() => localStorage.getItem("cohorta:pendingInvite")));
// membership check
const me = await (await fetch(`${PB}/api/collections/users/auth-with-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: email, password: "test12345" }) })).json();
const mem = await (await fetch(`${PB}/api/collections/group_members/records?filter=${encodeURIComponent(`user="${me.record.id}"`)}`, { headers: { Authorization: me.token } })).json();
console.log("4 memberships:", mem.totalItems);
await b.close();
