// Проверка редактора: панель форматирования, меню «···», теги, назначение предмета черновику.
// node scripts/editor-check.mjs <папка для скриншотов>
// Создаёт и удаляет одну тестовую лекцию без предмета у демо-пользователя.
import { chromium } from "playwright";
const out = process.argv[2];
const BASE = "http://127.0.0.1:5173";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(`${BASE}/login`);
await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
await p.fill('input[type="password"]', "12345678");
await p.click('button[type="submit"]');
await p.waitForURL(/\/s\//);

await p.goto(`${BASE}/s/1/storitelling/test/edit`);
await p.waitForTimeout(2000);
await p.screenshot({ path: `${out}/live-lecture.png` });
console.log("кнопки панели:", await p.locator(".bubble-menu > *").allInnerTexts());
await p.getByRole("button", { name: "Стиль текста" }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/menu-style.png` });
await p.keyboard.press("Escape");
await p.mouse.click(700, 300);
await p.getByRole("button", { name: "Ещё", exact: true }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/menu-more.png` });
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "Меню лекции" }).first().click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/menu-lecture.png` });
console.log("пункты меню:", await p.locator('[role="menu"] [role="menuitem"]').allInnerTexts());
await p.keyboard.press("Escape");

// черновик: создать, назначить предмет
await p.goto(`${BASE}/note/new`);
await p.waitForURL(/\/note\//, { timeout: 10000 });
await p.waitForTimeout(1500);
const draftUrl = p.url();
console.log("черновик:", draftUrl);
await p.getByRole("button", { name: "Меню лекции" }).first().click();
console.log("пункты меню черновика:", await p.locator('[role="menu"] [role="menuitem"]').allInnerTexts());
await p.getByRole("menuitem", { name: "Назначить предмет" }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/assign.png` });
await p.getByRole("radio", { name: /Сторителлинг/ }).click();
await p.getByRole("button", { name: "Назначить" }).click();
await p.waitForTimeout(1500);
console.log("после назначения:", p.url());
await p.screenshot({ path: `${out}/assigned.png` });

// удалить тестовую лекцию через меню (с подтверждением)
await p.getByRole("button", { name: "Меню лекции" }).first().click();
await p.getByRole("menuitem", { name: "Удалить" }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/delete-confirm.png` });
await p.getByRole("button", { name: "Удалить", exact: true }).click();
await p.waitForTimeout(800);
console.log("ошибки:", errors);
await b.close();
