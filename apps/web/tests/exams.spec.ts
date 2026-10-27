/**
 * ============================================
 *  tests/exams.spec.ts — Exam Engine (P3)
 * ============================================
 *
 * Сценарии 1–8 из плана Exam Engine (реконструированы из кода
 * модуля + ad-hoc смоука в .clinerules — исходный план-файл
 * nifty-waddling-shannon.md в репозитории отсутствует).
 *
 * Опорное состояние — сид `upsertExam` на курсе math-analysis
 * семестра demo: 8 билетов (#1,#2 ready — #1 с формулой
 * x^2+y^2=z^2; #3 draft; #4–#8 empty). Читающие тесты не
 * мутируют; тест 7 меняет билет #4 и откатывает его через
 * PocketBase API.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { login, DEMO_EMAIL, DEMO_PASSWORD } from "./helpers";

const PB = "http://127.0.0.1:8090";
const EXAM_BASE = "/s/demo/math-analysis/exam";

/** login-хелпер НЕ ждёт редиректа — дожидаемся его здесь, иначе
 *  последующий goto гоняется с логином и ProtectedRoute кидает на /login. */
async function loginDemo(page: Page): Promise<void> {
  await login(page, "demo");
  await page.waitForURL("**/s/demo");
}

test("1. точка входа экзамена: вкладка «Экзамен» на странице предмета", async ({ page }) => {
  await loginDemo(page);
  await page.goto("/s/demo/math-analysis");
  // Вкладки предмета «Лекции N | Пары N | Экзамен» (Screen-exam): последняя ведёт в центр подготовки.
  const tab = page.locator(".c-subject-tabs").getByRole("link", { name: "Экзамен", exact: true });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page).toHaveURL(/\/s\/demo\/math-analysis\/exam$/);
  await expect(page.locator(".c-exam-readiness").first()).toContainText("2 из 8 билетов готовы");
});

test("2. центр подготовки: hero, прогресс, карта чипов", async ({ page }) => {
  await loginDemo(page);
  await page.goto(EXAM_BASE);
  await expect(page.locator(".c-exam-head h1")).toContainText("Математический анализ");
  await expect(page.locator(".c-exam-readiness").first()).toContainText("2 из 8 билетов готовы");
  await expect(page.locator(".c-exam-map-grid .c-exam-chip")).toHaveCount(8);
  await expect(page.locator(".c-exam-chip.ready")).toHaveCount(2);
  await expect(page.locator(".c-exam-chip.draft")).toHaveCount(1);
});

test("3–4. импорт: разбор текста, номера убираются, билеты идут в конец", async ({ page }) => {
  await loginDemo(page);
  await page.goto(`${EXAM_BASE}/import`);
  await page.getByLabel("Список билетов").fill("1. Первый вопрос\n2. Второй вопрос\n3. Третий вопрос");

  // Screen-ticket-import: «Найдено 3 билета», предпросмотр без номеров из текста — новые билеты
  // получают следующие номера после существующих (в сиде занято 1–8), кнопка «Добавить 3 билета».
  await expect(page.locator(".c-import-col .hint.c-form-d")).toContainText("Найдено 3 билета");
  const rows = page.locator(".c-import-preview-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator(".num")).toHaveText("9");
  await expect(rows.nth(0).locator(".q")).toHaveText("Первый вопрос");
  await expect(rows.nth(2).locator(".num")).toHaveText("11");
  await expect(rows.locator("text=Новый")).toHaveCount(3);
  // Не сохраняем: читающий тест не мутирует сид.
  await expect(page.getByRole("button", { name: "Добавить 3 билета" }).first()).toBeEnabled();
});

test("5. шпаргалка: только ready-билеты, формула отрендерена", async ({
  page,
}) => {
  await loginDemo(page);
  await page.goto(`${EXAM_BASE}/cheatsheet`);
  await expect(page.locator(".c-cheatsheet-item")).toHaveCount(2);
  await expect(
    page.locator(".c-cheatsheet-item").first().locator("math-div.math-render")
  ).toBeVisible({ timeout: 10000 });
});

test("6. счётчик готовности на хабе совпадает со списком билетов", async ({ page }) => {
  await loginDemo(page);
  await page.goto(EXAM_BASE);
  // Счётчик «2 из 8» (Screen-exam): в шапке хаба и в списке билетов — те же 2 готовых из 8.
  await expect(page.locator(".c-exam-readiness").first()).toContainText("2 из 8 билетов готовы");
  const rows = page.locator(".c-exam-ticket-row");
  await expect(rows).toHaveCount(8);
  await expect(rows.locator(".c-chip.ok", { hasText: "Готов" })).toHaveCount(2);
});

test("7. дашборд: блок «экзамен скоро» скрыт без даты экзамена", async ({
  page,
}) => {
  await loginDemo(page);
  await page.goto("/s/demo");
  await expect(page.locator(".c-dash-head h1")).toBeVisible();
  // Блок «Экзамен · …» на дашборде появляется только у экзамена с датой.
  await expect(page.locator(".c-dash h2", { hasText: "Экзамен ·" })).toHaveCount(0);
  await expect(page.locator(".c-dash")).not.toContainText("Экзамен через");
  await expect(page.locator(".c-dash")).not.toContainText("Экзамен сегодня");
});

test("8. билет: empty → draft (автосейв) → ready (кнопка)", async ({
  page,
  request,
}) => {
  await loginDemo(page);
  await restoreTicket(request, 4); // на случай мусора от прошлого прогона

  try {
    // билет #4 сейчас empty — набираем ответ
    await page.goto(`${EXAM_BASE}/4/edit`);
    const editor = page.locator(".editor-inline .tiptap");
    await editor.click();
    await editor.pressSequentially("Черновой ответ на билет №4.", { delay: 20 });
    await expect(page.locator(".save-indicator.saved")).toBeVisible({
      timeout: 15000,
    });

    // статус сам стал draft — на карте чипов теперь 2 draft (#3 + #4)
    await page.goto(EXAM_BASE);
    await expect(page.locator(".c-exam-chip.draft")).toHaveCount(2);

    // ручное повышение до ready → markReady уводит на просмотр билета
    // (раньше на хаб), на хабе готовых становится 2 → 3
    await page.goto(`${EXAM_BASE}/4/edit`);
    await page
      .locator("button", { hasText: "Отметить готовым" })
      .dispatchEvent("click");
    await page.waitForURL(/\/exam\/4$/, { timeout: 15000 });
    await page.goto(EXAM_BASE);
    await expect(page.locator(".c-exam-readiness").first()).toContainText("3 из 8 билетов готовы");
  } finally {
    await restoreTicket(request, 4);
  }
});

/** Откат билета в исходное empty-состояние через PocketBase API. */
async function restoreTicket(
  request: APIRequestContext,
  number: number
): Promise<void> {
  const auth = await request
    .post(`${PB}/api/collections/users/auth-with-password`, {
      data: { identity: DEMO_EMAIL, password: DEMO_PASSWORD },
    })
    .then((r) => r.json());
  const exams = await request
    .get(`${PB}/api/collections/exams/records?perPage=50`, {
      headers: { Authorization: auth.token },
    })
    .then((r) => r.json());
  for (const ex of exams.items ?? []) {
    const t = await request
      .get(
        `${PB}/api/collections/exam_tickets/records?filter=${encodeURIComponent(
          `exam="${ex.id}" && number=${number}`
        )}`,
        { headers: { Authorization: auth.token } }
      )
      .then((r) => r.json());
    for (const row of t.items ?? []) {
      await request.patch(
        `${PB}/api/collections/exam_tickets/records/${row.id}`,
        {
          headers: { Authorization: auth.token },
          data: { status: "empty", answer: "" },
        }
      );
    }
  }
}
