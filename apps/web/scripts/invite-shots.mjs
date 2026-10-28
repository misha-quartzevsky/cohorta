// Снимки окна «Пригласить» на 1440 и 390 (запуск 7, C2). Использование:
//   E2E_BASE_URL=http://localhost:5175 PB_URL=http://127.0.0.1:8091 node scripts/invite-shots.mjs <папка>
// Группа создаётся через интерфейс, ссылка открывается через API (в состоянии «до» кнопка в окне не нажимается мышью).
import { firefox } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5175";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8091";
const out = process.argv[2];
if (!out) throw new Error("укажи папку для снимков");
mkdirSync(out, { recursive: true });

const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Moscow" });
const page = await ctx.newPage();
const email = `shots-${Date.now()}@example.com`;
await page.goto(`${BASE}/register`);
await page.locator('input[type="email"]').fill(email);
const pw = page.locator('input[type="password"]');
await pw.nth(0).fill("test12345");
await pw.nth(1).fill("test12345");
await pw.nth(1).press("Enter");
await page.waitForURL(/\/onboarding$/);
await page.getByLabel("Как тебя зовут").fill("Снимки");
await page.getByRole("button", { name: /^Далее$/ }).dispatchEvent("click");
await page.getByLabel("Город").fill("Москва");
await page.locator(".c-onb-sugg button", { hasText: "Москва" }).first().dispatchEvent("click");
await page.getByRole("option").first().dispatchEvent("click");
await page.getByRole("button", { name: /^Далее$/ }).dispatchEvent("click");
await page.getByRole("button", { name: "Бакалавриат", exact: true }).dispatchEvent("click");
await page.getByRole("button", { name: "1 курс", exact: true }).dispatchEvent("click");
await page.getByRole("button", { name: /^Далее$/ }).dispatchEvent("click");
await page.getByRole("button", { name: /^(Далее|Готово)$/ }).dispatchEvent("click");
await page.locator(".c-dash").waitFor();

await page.goto(`${BASE}/s/1/group/new`);
await page.getByLabel("Название").fill("Группа для снимков");
await page.getByRole("button", { name: "Создать группу", exact: true }).click();
await page.waitForURL(/invite=1/);

const auth = await (await fetch(`${PB}/api/collections/users/auth-with-password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identity: email, password: "test12345" }),
})).json();
const groups = await (await fetch(`${PB}/api/collections/groups/records`, { headers: { Authorization: auth.token } })).json();
const gid = groups.items[0].id;
await fetch(`${PB}/api/groups/${gid}/invite/enable`, {
  method: "POST",
  headers: { "content-type": "application/json", Authorization: auth.token },
  body: JSON.stringify({ enabled: true }),
});

for (const [name, width, height] of [["1440", 1440, 900], ["390", 390, 844]]) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/s/1/group`);
  await page.getByRole("button", { name: "Пригласить", exact: true }).click();
  await page.locator(".c-gr-invite-pop:visible").first().waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/invite-${name}.png` });
}
await browser.close();
console.log("снимки:", out);
