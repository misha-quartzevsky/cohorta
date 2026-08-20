/**
 * ============================================
 *  tests/tables.spec.ts — таблицы в редакторе
 * ============================================
 *
 * Регрессия: таблицы не поддерживались (Obsidian-вставка падала в plain-text),
 * мини-тулбар отсутствовал. Проверяем:
 *   1. Пункт «Таблица» в slash-меню вставляет таблицу 3×3 с шапкой.
 *   2. Появляется быстрый тулбар `.table-menu` (когда курсор в таблице).
 *   3. Правка ячейки → автосохранение → reload → таблица с текстом на месте.
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("таблица вставляется из slash-меню, есть тулбар, правка сохраняется", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/s/demo/math-analysis/limit-of-sequence");

  await page.locator('button[title="Редактировать"]').click();
  await page.waitForURL("**/limit-of-sequence/edit");

  const editable = page.locator(".tiptap-editor");
  await expect(editable).toBeVisible();

  // Сколько таблиц уже лежит в лекции (от прошлых прогонов) — новая появится
  // на этом индексе.
  const before = await page.locator(".tiptap-editor table").count();

  // Ставим курсор в конец документа.
  await editable.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    (el as HTMLElement).focus();
  });

  // Slash-меню открывается в начале строки — переходим на новый пустой блок.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/Таблица");
  const slashItem = page.locator(".slash-menu-item", { hasText: "Таблица" });
  await expect(slashItem).toBeVisible();
  await slashItem.click();

  // Именно вставленная таблица 3×3 с шапкой (3 <th> + 6 <td>).
  const table = page.locator(".tiptap-editor table").nth(before);
  await expect(table).toBeVisible();
  await expect(table.locator("th")).toHaveCount(3);
  await expect(table.locator("td")).toHaveCount(6);

  // Мини-тулбар таблицы появляется, когда курсор внутри таблицы.
  const toolbar = page.locator(".table-menu");
  await expect(toolbar).toBeVisible();

  // Пишем в первую ячейку.
  await table.locator("td").first().click();
  await page.keyboard.type("e2e-table");
  await expect(table.locator("td").first()).toContainText("e2e-table");

  // Автосохранение (debounce ~1.2 с) → reload → таблица с текстом на месте.
  await expect(page.locator(".save-indicator.saved")).toContainText(
    "Обновлено только что",
    { timeout: 20000 }
  );
  await page.reload();
  const persisted = page
    .locator(".tiptap-editor table")
    .filter({ hasText: "e2e-table" })
    .first();
  await expect(persisted).toBeVisible({ timeout: 15000 });
  await expect(persisted.locator("th")).toHaveCount(3);
  await expect(persisted.locator("td")).toHaveCount(6);
  await expect(persisted.locator("td").first()).toContainText("e2e-table");
});

test("вставка markdown-таблицы из Obsidian собирает настоящую таблицу", async ({
  page,
}) => {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
  await page.goto("/s/demo/math-analysis/limit-of-sequence");

  await page.locator('button[title="Редактировать"]').click();
  await page.waitForURL("**/limit-of-sequence/edit");

  const editable = page.locator(".tiptap-editor");
  await expect(editable).toBeVisible();

  // Obsidian копирует таблицу как plain-text markdown. Синтезируем paste
  // с text/plain в буфере (не все движки кладут clipboardData в конструктор
  // ClipboardEvent — страхуемся defineProperty).
  const md = [
    "| Критерий | Индия | Казахстан | Индонезия |",
    "| --- | --- | --- | --- |",
    "| **Объем рынка** | Очень высокий | Средний | Низкий |",
    "| **Рост EdTech** | 34% (2024) | 21% (2023) | 8% (2024) |",
  ].join("\n");
  await page.evaluate(
    ({ md }) => {
      const el = document.querySelector(".tiptap-editor") as HTMLElement;
      // Курсор в конец документа — вставка случится последним блоком.
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      el.focus();

      const dt = new DataTransfer();
      dt.setData("text/plain", md);
      const ev = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      if (ev.clipboardData !== dt) {
        Object.defineProperty(ev, "clipboardData", { value: dt, configurable: true });
      }
      el.dispatchEvent(ev);
    },
    { md }
  );

  // Ищем именно вставленную таблицу по содержимому (в лекции могут лежать
  // пустые 3×3-таблицы от прошлых прогонов slash-теста).
  const table = page
    .locator(".tiptap-editor table")
    .filter({ hasText: "Объем рынка" })
    .last();
  await expect(table).toBeVisible();
  await expect(table.locator("th")).toHaveCount(4);
  await expect(table.locator("td")).toHaveCount(8); // 2 строки данных × 4 колонки

  // Данные собраны по ячейкам, а markdown-разметка ушла в <strong>.
  await expect(table.locator("td").first().locator("strong")).toHaveText(
    "Объем рынка"
  );
  await expect(table.locator("td").nth(1)).toHaveText("Очень высокий");
  await expect(table).toContainText("21% (2023)");

  // Сырой markdown-каркас в текст не попал.
  const content = await editable.textContent();
  expect(content).not.toContain("| --- |");
});
