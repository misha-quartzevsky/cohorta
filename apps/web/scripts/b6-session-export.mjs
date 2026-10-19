// Проверка руками: существующий пользователь — вход, восстановление сессии, выход; выгрузка ZIP.
// node scripts/b6-session-export.mjs <папка для файлов>
import { chromium } from "playwright";

const OUT = process.argv[2];
const BASE = "http://127.0.0.1:5173";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));

await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
console.log("login ->", p.url().replace(BASE, ""));

await p.reload();
await p.waitForSelector(".c-shell");
console.log("after reload still in app:", p.url().replace(BASE, ""));

await p.goto(`${BASE}/settings`);
await p.waitForSelector(".c-erow");
const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click('.c-erow:has-text("Экспорт") .act')]);
const path = `${OUT}/export.zip`;
await dl.saveAs(path);
console.log("download:", dl.suggestedFilename());

await p.setViewportSize({ width: 390, height: 844 });
await p.goto(`${BASE}/profile`);
await p.waitForSelector(".c-profile");
await p.click('.c-profile-row:has-text("Выйти")');
await p.waitForURL(/login/);
console.log("logout ->", p.url().replace(BASE, ""));
await p.goto(`${BASE}/tasks`);
await p.waitForURL(/login/);
console.log("protected route after logout ->", p.url().replace(BASE, ""));
await b.close();
