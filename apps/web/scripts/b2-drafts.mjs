// «Черновики» и меню лекции: node scripts/b2-drafts.mjs <папка>. Демо-вход.
// Создаёт 3 лекции без предмета с пометкой «ZZ», проходит назначение предмета, отмену,
// переименование, копию, перенос, удаление; в конце удаляет всё созданное.
import { chromium } from "playwright";
const OUT = process.argv[2];
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB ?? "http://127.0.0.1:8090";
let failed = 0;
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) failed++; };

const b = await chromium.launch();
async function session(w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', process.env.DEMO_EMAIL);
  await p.fill('input[type="password"]', process.env.DEMO_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/s\//);
  return p;
}
const api = (p, fn, arg) => p.evaluate(fn, { pb: PB, ...arg });

const p = await session(1440, 900);
const created = [];
for (const [i, t] of ["ZZ Конспект про сделки", "ZZ Без названия", "ZZ Лекция 1"].entries()) {
  const r = await api(p, async ({ pb, t, i }) => {
    const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
    const h = { "Content-Type": "application/json", Authorization: auth.token };
    const res = await fetch(`${pb}/api/collections/lectures/records`, { method: "POST", headers: h, body: JSON.stringify({ title: t, content: "<p>слово ".repeat(40 * (i + 1)) + "</p>", slug: `zz-draft-${Date.now()}-${i}`, owner: auth.record?.id }) });
    return (await res.json()).id;
  }, { t, i });
  created.push(r);
}
const cleanup = async (page) => {
  await page.evaluate(async ({ pb }) => {
    const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
    const h = { Authorization: auth.token };
    const r = await (await fetch(`${pb}/api/collections/lectures/records?perPage=200&filter=${encodeURIComponent('title~"ZZ " || title~"(копия)"')}`, { headers: h })).json();
    for (const it of r.items ?? []) await fetch(`${pb}/api/collections/lectures/records/${it.id}`, { method: "DELETE", headers: h });
  }, { pb: PB });
};

try {
  await p.goto(`${BASE}/s/demo/lectures`);
  const side = p.locator(".c-shell-courses a", { hasText: "Черновики" });
  await side.waitFor({ timeout: 8000 });
  ok((await p.locator(".c-shell-courses a").first().innerText()).includes("Черновики"), "«Черновики» первой строкой в сайдбаре");
  await side.click();
  await p.waitForURL(/\/drafts$/);
  await p.waitForSelector(".c-drafts-list .c-row");
  const n0 = await p.locator(".c-drafts-list .c-row").count();
  ok(n0 >= 3, `на странице черновиков строк: ${n0}`);
  await p.getByRole("button", { name: "Назначить предмет" }).first().click();
  await p.screenshot({ path: `${OUT}/drafts-1440.png` });
  await p.getByRole("menuitem", { name: "Философия" }).click();
  await p.waitForTimeout(800);
  const n1 = await p.locator(".c-drafts-list .c-row").count();
  ok(n1 === n0 - 1, `назначение предмета убирает строку (${n0} → ${n1})`);
  ok(await p.getByText("Перенесено в «Философия»").isVisible(), "тост «Перенесено в «Философия»»");
  await p.getByRole("button", { name: "Отменить" }).click();
  await p.waitForTimeout(800);
  ok((await p.locator(".c-drafts-list .c-row").count()) === n0, "«Отменить» возвращает лекцию в черновики");

  // меню лекции
  await p.locator(".c-lec-more").first().click();
  await p.screenshot({ path: `${OUT}/lecture-menu-1440.png` });
  ok((await p.getByRole("menuitem").allInnerTexts()).join("|").includes("Скачать"), "меню лекции открывается");
  await p.getByRole("menuitem", { name: "Переименовать" }).click();
  await p.keyboard.press("Control+A");
  await p.keyboard.type("ZZ Новое имя");
  await p.keyboard.press("Enter");
  await p.getByText("ZZ Новое имя").waitFor({ timeout: 5000 });
  ok(true, "переименование на месте (Enter сохраняет)");
  await p.locator(".c-lec-more").first().click();
  await p.getByRole("menuitem", { name: "Дублировать" }).click();
  await p.getByText("Копия создана").waitFor({ timeout: 5000 });
  ok(true, "дублирование: «Копия создана»");
  await p.locator(".c-lec-more").first().click();
  await p.getByRole("menuitem", { name: "Перенести в предмет" }).click();
  await p.screenshot({ path: `${OUT}/lecture-move-1440.png` });
  await p.getByRole("radio", { name: /Маркетинг|Физика|Философия/ }).first().click();
  await p.getByRole("button", { name: "Перенести", exact: true }).click();
  await p.getByText(/Перенесено в «/).first().waitFor({ timeout: 5000 });
  ok(true, "перенос в предмет через окно");
  await p.locator(".c-lec-more").first().click();
  await p.getByRole("menuitem", { name: "Удалить" }).click();
  await p.screenshot({ path: `${OUT}/lecture-delete-1440.png` });
  await p.getByRole("button", { name: "Удалить", exact: true }).click();
  await p.getByText("Лекция в корзине").waitFor({ timeout: 5000 });
  ok(true, "удаление: «Лекция в корзине» с «Отменить»");
  await p.getByRole("button", { name: "Отменить" }).first().click();

  // период на десктопе
  await p.goto(`${BASE}/s/demo/lectures`);
  await p.getByRole("button", { name: /^Период:/ }).click();
  ok(await p.getByRole("option", { name: /Все периоды/ }).isVisible(), "период на компьютере: список с «Все периоды»");
  await p.screenshot({ path: `${OUT}/period-1440.png` });
} catch (e) {
  failed++;
  console.log("FAIL", e.message.split("\n")[0]);
}
await cleanup(p);
await p.close();

// телефон
const m = await session(390, 844);
const mid = await api(m, async ({ pb }) => {
  const auth = JSON.parse(localStorage.getItem("pocketbase_auth") || "{}");
  const h = { "Content-Type": "application/json", Authorization: auth.token };
  const res = await fetch(`${pb}/api/collections/lectures/records`, { method: "POST", headers: h, body: JSON.stringify({ title: "ZZ Телефон", content: "<p>раз два</p>", slug: `zz-m-${Date.now()}`, owner: auth.record?.id }) });
  return (await res.json()).id;
}, {});
try {
  await m.goto(`${BASE}/s/demo/lectures`);
  await m.getByRole("radio", { name: "Предметы" }).click();
  await m.getByText("Лекции без предмета").waitFor();
  await m.screenshot({ path: `${OUT}/lectures-subjects-390.png` });
  await m.getByText("Лекции без предмета").click();
  await m.waitForURL(/\/drafts$/);
  await m.getByRole("button", { name: "Предмет", exact: true }).first().waitFor();
  await m.screenshot({ path: `${OUT}/drafts-390.png` });
  await m.getByRole("button", { name: "Предмет", exact: true }).first().click();
  await m.getByRole("listbox", { name: "Предмет" }).waitFor();
  await m.screenshot({ path: `${OUT}/drafts-assign-390.png` });
  ok(true, "телефон: черновики и шторка «Назначить предмет»");
  await m.keyboard.press("Escape");
  // долгое нажатие на строку лекции в списке открывает лист меню, обычный тап лекцию открывает
  await m.goto(`${BASE}/s/demo/lectures`);
  await m.waitForSelector(".c-lec-row");
  const press = (sel) => m.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, pointerType: "touch", clientX: r.left + 40, clientY: r.top + 20, isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
  }, sel);
  await press(".c-lec-row");
  await m.waitForTimeout(700);
  await m.evaluate(() => document.querySelector(".c-lec-row").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" })));
  await m.getByRole("menu", { name: "Действия" }).waitFor({ timeout: 3000 });
  ok(true, "долгое нажатие на строку открывает лист меню");
  ok((await m.locator(".c-lec-sheet-list button").allInnerTexts()).join("|").includes("Дублировать"), "в листе есть «Дублировать»");
  ok(!(await m.locator(".c-lec-sheet-list").innerText()).includes("Доступ"), "пункта «Доступ» нет");
  await m.screenshot({ path: `${OUT}/lecture-menu-390.png` });
  await m.keyboard.press("Escape");
  ok(m.url().endsWith("/lectures"), "после долгого нажатия лекция не открылась");
  // короткое движение пальца — не долгое нажатие (прокрутка не ломается)
  await m.evaluate(() => {
    const el = document.querySelector(".c-lec-row");
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", clientX: r.left + 40, clientY: r.top + 20 }));
    el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "touch", clientX: r.left + 40, clientY: r.top + 60 }));
  });
  await m.waitForTimeout(700);
  ok((await m.getByRole("menu", { name: "Действия" }).count()) === 0, "сдвиг пальца отменяет долгое нажатие");
  // «···» в верхней строке открытой лекции
  await m.locator(".c-lec-row").first().click();
  await m.waitForSelector(".c-shell-more");
  await m.locator(".c-shell-more").click();
  await m.getByRole("menu", { name: "Действия" }).waitFor({ timeout: 3000 });
  ok(true, "«···» в верхней строке лекции открывает тот же лист");
  await m.screenshot({ path: `${OUT}/editor-menu-390.png` });
} catch (e) {
  failed++;
  console.log("FAIL", e.message.split("\n")[0]);
}
await cleanup(m);
await b.close();
console.log(failed ? `\nПровалено: ${failed}` : "\nВсе проверки пройдены");
process.exit(failed ? 1 : 0);
