// Воспроизведение (класс C, «Разбор Playwright»): на десктопе в новом интерфейсе нет выхода из аккаунта.
// Нужны: PocketBase (песочница, node scripts/e2e-sandbox.mjs) и Vite на http://localhost:5173.
//   node scripts/repro-desktop-logout.mjs
//
// Шаги: вход демо-аккаунтом через API (токен в localStorage) → на ширине 1440 открыть «/», «/settings»
// и «/profile» → искать кнопку или ссылку «Выйти»; затем то же на ширине 390.
// Ожидание (по макетам Screen-settings и Screen-m-profile): «Выйти» есть. Факт: на 1440 нет нигде,
// «/profile» перенаправляет на «/settings»; на 390 есть в «/profile».
import { firefox } from "@playwright/test";

const web = process.env.WEB_URL ?? "http://localhost:5173";
const pb = process.env.PB_URL ?? "http://127.0.0.1:8090";
const auth = await (
  await fetch(`${pb}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: "asyaobraz17@gmail.com", password: "12345678" }),
  })
).json();

const browser = await firefox.launch({ headless: true });
let found = false;
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript(([t, r]) => localStorage.setItem("pocketbase_auth", JSON.stringify({ token: t, record: r })), [auth.token, auth.record]);
  for (const path of ["/", "/settings", "/profile"]) {
    const page = await ctx.newPage();
    await page.goto(web + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const has = await page.evaluate(() => /(^|\s)Выйти(\s|$)/.test(document.body.innerText));
    console.log(`ширина ${width}, ${path} → ${new URL(page.url()).pathname}: «Выйти» ${has ? "ЕСТЬ" : "нет"}`);
    if (width === 1440 && has) found = true;
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(found ? "на десктопе «Выйти» найдена: дефект не воспроизводится" : "ВОСПРОИЗВЕДЕНО: на десктопе нет «Выйти» ни на «/», ни на «/settings», ни на «/profile»");
