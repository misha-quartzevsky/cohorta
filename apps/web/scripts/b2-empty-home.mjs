// Пустая Главная нового пользователя (B2): node scripts/b2-empty-home.mjs <папка>
// Создаёт одноразового пользователя, проходит онбординг, снимает Главную (1440 и 390),
// затем добавляет предмет через API и снимает Главную ещё раз (шаг 1 исчезает).
// Пользователя после проверки удаляет.
import { chromium } from "playwright";
const OUT = process.argv[2];
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB ?? "http://127.0.0.1:8090";
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto(`${BASE}/register`);
  const email = `b2-empty-${w}-${Date.now()}@example.com`;
  await p.fill('input[type="email"]', email);
  const pw = p.locator('input[type="password"]');
  await pw.nth(0).fill("test12345");
  await pw.nth(1).fill("test12345");
  await p.click('button[type="submit"]');
  await p.waitForURL(/onboarding/, { timeout: 15000 });
  await p.waitForSelector(".c-onb-card");
  await p.fill(".c-onb-body input[type=text], .c-onb-body input:not([type])", "Тест Пустой");
  await p.click(".c-onb-nav .primary");
  await p.waitForSelector(".c-onb-combo");
  await p.fill(".c-onb-combo input", "Москва");
  await p.waitForTimeout(500);
  await p.click(".c-onb-sugg button");
  await p.waitForSelector(".c-onb-unis");
  await p.click(".c-onb-unis button >> nth=0");
  await p.click(".c-onb-nav .primary");
  await p.click("text=Специалитет");
  await p.click('.c-onb-round[aria-label="2 курс"]');
  await p.click(".c-onb-nav .primary");
  await p.waitForSelector(".c-onb-plist");
  await p.click(".c-onb-nav .primary");
  await p.waitForURL(/\/s\//, { timeout: 30000 });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/home-empty-${w}.png` });

  // Один предмет через API: шаг 1 должен исчезнуть, подпись «Три шага» тоже.
  const made = await p.evaluate(async (pb) => {
    const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
    const h = { "Content-Type": "application/json", Authorization: auth.token };
    const sems = await (await fetch(`${pb}/api/collections/semesters/records?perPage=1`, { headers: h })).json();
    const sem = sems.items?.[0]?.id;
    const r = await fetch(`${pb}/api/collections/courses/records`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Тестовый предмет", slug: "test-subject", semesters: sem, owner: auth.record?.id, cover_seed: 140 }),
    });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, text: JSON.stringify(body).slice(0, 200), courseId: body.id, uid: auth.record?.id, token: auth.token };
  }, PB);
  console.log(w, "course:", made.status, made.status === 200 ? "" : made.text);
  await p.reload();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/home-one-subject-${w}.png` });

  // уборка: пользователь и его записи
  const del = await p.evaluate(async ({ pb, uid, token, courseId }) => {
    // Сначала предмет: при удалении пользователя «сиротская» запись с пустым owner видна всем.
    if (courseId) await fetch(`${pb}/api/collections/courses/records/${courseId}`, { method: "DELETE", headers: { Authorization: token } });
    const r = await fetch(`${pb}/api/collections/users/records/${uid}`, { method: "DELETE", headers: { Authorization: token } });
    return r.status;
  }, { pb: PB, uid: made.uid, token: made.token, courseId: made.courseId });
  console.log(w, "delete user:", del);
  await ctx.close();
}
await b.close();
