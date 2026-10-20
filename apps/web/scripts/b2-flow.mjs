// Проверка переходов волны B2 руками (Playwright): node scripts/b2-flow.mjs
// Демо-вход. Создаёт одну лекцию на странице предмета и удаляет её в конце.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB ?? "http://127.0.0.1:8090";
const SEM = "demo";
const SUBJECT = "math-analysis";
let failed = 0;
const ok = (cond, msg) => {
  console.log(cond ? "ok  " : "FAIL", msg);
  if (!cond) failed++;
};

const b = await chromium.launch();

async function login(p) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
  await p.fill('input[type="password"]', "12345678");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/s\//, { timeout: 15000 });
}

/* ---------- Компьютер ---------- */
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await login(p);
  await p.goto(`${BASE}/s/${SEM}/lectures`);
  await p.waitForSelector(".c-lec-list .c-row");
  const total = await p.locator(".c-lec-list .c-row").count();
  ok(total > 0, `«Все лекции»: строк ${total}`);
  ok((await p.locator(".c-lec-group-title").first().innerText()).length > 0, "заголовок группы есть");

  await p.getByRole("tab", { name: /^Не начато/ }).click();
  const notStarted = await p.locator(".c-lec-list .c-row").count();
  ok(notStarted <= total, `фильтр «Не начато»: ${notStarted} из ${total}`);
  await p.getByRole("tab", { name: /^Все/ }).click();

  await p.locator(".c-lec-list .c-row").first().click();
  await p.waitForURL(new RegExp(`/s/${SEM}/[^/]+/[^/]+$|/note/`), { timeout: 10000 });
  ok(true, `строка лекции открывает редактор: ${new URL(p.url()).pathname}`);

  // Страница предмета
  await p.goto(`${BASE}/s/${SEM}/${SUBJECT}`);
  await p.waitForSelector(".c-lec-list .c-row");
  await p.getByRole("tab", { name: /^Пары/ }).click();
  await p.waitForURL(/\/pairs$/);
  ok(true, "вкладка «Пары» → /pairs");
  await p.goto(`${BASE}/s/${SEM}/${SUBJECT}`);
  await p.getByRole("tab", { name: /^Экзамен/ }).click();
  await p.waitForURL(/\/exam$/);
  ok(true, "вкладка «Экзамен» → /exam");

  await p.goto(`${BASE}/s/${SEM}/${SUBJECT}`);
  await p.waitForSelector(".c-lec-list .c-row");
  await p.getByRole("button", { name: "Новая лекция" }).click();
  await p.waitForURL(/\/edit$/, { timeout: 10000 });
  const created = new URL(p.url()).pathname.split("/").slice(-2)[0];
  ok(true, `«Новая лекция» создаёт лекцию в предмете и открывает редактор: ${created}`);

  // Уборка: удалить созданную лекцию
  const removed = await p.evaluate(async ({ pb, slug }) => {
    const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
    const h = { Authorization: auth.token };
    const r = await (await fetch(`${pb}/api/collections/lectures/records?filter=${encodeURIComponent(`slug="${slug}"`)}`, { headers: h })).json();
    const id = r.items?.[0]?.id;
    if (!id) return "нет записи";
    return (await fetch(`${pb}/api/collections/lectures/records/${id}`, { method: "DELETE", headers: h })).status;
  }, { pb: PB, slug: created });
  console.log("   удалена тестовая лекция:", removed);

  // Поиск: предмет ведёт на страницу предмета
  await p.goto(`${BASE}/s/${SEM}/lectures`);
  await p.locator(".c-shell-side-search").click();
  await p.fill('input[aria-label="Поиск по продукту"]', "анализ");
  await p.waitForSelector(".c-search-results .c-row");
  const subjRow = p.locator(".c-search-results section", { hasText: "Предметы" }).locator(".c-row").first();
  await subjRow.click();
  await p.waitForURL(new RegExp(`/s/${SEM}/[^/]+$`));
  ok(true, `результат-предмет → страница предмета: ${new URL(p.url()).pathname}`);
  await p.locator(".c-shell-side-search").click();
  await p.keyboard.press("Escape");
  ok((await p.locator(".c-search-overlay").count()) === 0, "Esc закрывает поиск");
  // ⌘K / Ctrl+K открывает поиск, строки поиска в шапке нет
  await p.goto(`${BASE}/s/${SEM}/lectures`);
  ok((await p.locator(".c-shell-topbar").count()) === 0, "на компьютере верхней строки нет");
  await p.keyboard.press("Control+k");
  ok(await p.locator(".c-search-overlay").isVisible(), "Ctrl+K открывает поиск");
  await p.keyboard.press("Escape");
  // период запоминается отдельно для каждого списка
  await p.getByRole("button", { name: /^Период:/ }).click();
  await p.getByRole("option", { name: "Все периоды" }).click();
  await p.goto(`${BASE}/s/${SEM}/${SUBJECT}`);
  ok(!(await p.getByRole("button", { name: /^Период: Все периоды/ }).isVisible()), "период «Все лекции» не влияет на страницу предмета");
  await p.goto(`${BASE}/s/${SEM}/lectures`);
  ok(await p.getByRole("button", { name: /^Период: Все периоды/ }).isVisible(), "выбор периода запомнен для «Все лекции»");
  await p.evaluate(() => localStorage.removeItem("cohorta:period:lectures"));
  await p.close();
}

/* ---------- Телефон ---------- */
{
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(p);
  await p.goto(`${BASE}/s/${SEM}/lectures`);
  await p.waitForSelector(".c-lec-list .c-row");
  ok((await p.locator(".c-shell-topbar").count()) === 0, "на корневом экране телефона верхней строки нет");
  await p.getByRole("radio", { name: "Предметы" }).click();
  await p.waitForSelector(".c-lec-subjects .c-row");
  const rowsCount = await p.locator(".c-lec-subjects .c-row").count();
  ok(rowsCount > 0, `вкладка «Предметы»: ${rowsCount} предметов`);
  await p.locator(".c-lec-subjects .c-row").first().click();
  await p.waitForURL(new RegExp(`/s/${SEM}/[^/]+$`));
  ok(true, "строка предмета → страница предмета");
  await p.getByRole("button", { name: "Лекции", exact: true }).waitFor();
  ok(true, "«‹ Лекции» есть");
  await p.getByRole("button", { name: "Лекции", exact: true }).click();
  await p.waitForURL(new RegExp(`/s/${SEM}/lectures$`));
  ok(true, "«‹ Лекции» возвращает на «Все лекции»");
  await p.getByRole("button", { name: /^Период/ }).click();
  ok(await p.getByRole("listbox", { name: "Период" }).isVisible(), "окно «Период» открывается");
  await p.getByRole("option", { name: "Все периоды" }).evaluate((el) => el.scrollIntoView());
  await p.getByRole("option", { name: "Все периоды" }).click({ force: true });
  ok(await p.getByRole("button", { name: /^Период: Все периоды/ }).isVisible(), "выбор «Все периоды» меняет кнопку периода");
  await p.locator(".c-search-m").click();
  ok(await p.locator(".c-search-overlay").isVisible(), "иконка поиска открывает поиск");
  await p.getByRole("button", { name: "Отмена" }).click();
  ok((await p.locator(".c-search-overlay").count()) === 0, "«Отмена» закрывает поиск");
  await p.close();
}

await b.close();
console.log(failed ? `\nПровалено проверок: ${failed}` : "\nВсе проверки пройдены");
process.exit(failed ? 1 : 0);
