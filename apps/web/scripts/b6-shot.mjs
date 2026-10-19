import { chromium } from "playwright";
const OUT = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:5173/login");
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//, { timeout: 15000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/m-home.png`, fullPage: true });
for (const [u,n] of [["/tasks","m-tasks"],["/profile","m-profile"]]) { await p.goto("http://127.0.0.1:5173"+u); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/${n}.png` }); }
await b.close();
