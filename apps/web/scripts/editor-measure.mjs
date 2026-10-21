import { chromium } from "playwright";
const BASE = "http://127.0.0.1:5173";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//);
await p.goto(`${BASE}/s/1/storitelling/test`);
await p.waitForTimeout(2000);
const r = await p.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.width)]; };
  return { content: q(".c-shell-content"), page: q(".c-shell-content > .page"), simple: q(".workspace-simple"), main: q(".workspace-main"), art: q(".c-lecture"), title: q(".lecture-title-input"), aside: q(".c-lecture-aside") };
});
console.log(JSON.stringify(r));
await b.close();
