// Скриншот /settings на 1440 для сверки до/после правки C1.  node scripts/shot-settings.mjs <файл.png>
import { firefox } from "@playwright/test";

const out = process.argv[2];
const web = "http://localhost:5173";
const pb = "http://127.0.0.1:8090";
const auth = await (
  await fetch(`${pb}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: "asyaobraz17@gmail.com", password: "12345678" }),
  })
).json();
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(([t, r]) => localStorage.setItem("pocketbase_auth", JSON.stringify({ token: t, record: r })), [auth.token, auth.record]);
const page = await ctx.newPage();
await page.goto(`${web}/settings#data`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
