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

test("1. точка входа экзамена на странице курса", async ({ page }) => {
  await loginDemo(page);
  await page.goto("/s/demo/math-analysis");
  const entry = page.locator(".exam-entry");
  await expect(entry).toBeVisible();
  await expect(entry.locator(".exam-entry-meta")).toHaveText("2 из 8 готовы");
});

test("2. центр подготовки: hero, прогресс, карта чипов", async ({ page }) => {
  await loginDemo(page);
  await page.goto(EXAM_BASE);
  await expect(page.locator(".exam-hero-title")).toContainText("Математический анализ");
  await expect(page.locator(".exam-progress-text")).toHaveText("2 из 8 готовы");
  await expect(page.locator(".exam-map-grid .exam-chip")).toHaveCount(8);
  await expect(page.locator(".exam-chip.ready")).toHaveCount(2);
  await expect(page.locator(".exam-chip.draft")).toHaveCount(1);
});

test("3–4. импорт: разбор текста + пометка занятых номеров", async ({ page }) => {
  await loginDemo(page);
  await page.goto(`${EXAM_BASE}/import`);
  await page
    .locator(".exam-import-textarea")
    .fill("1. Первый вопрос\n2. Второй вопрос\n3. Третий вопрос");
  await page.locator("button", { hasText: "Разобрать текст" }).click();

  const source = page.locator(".exam-import-source");
  await expect(source).toContainText("Разобрано по строкам: 3");
  await expect(source).toContainText("будут пропущены: 1, 2, 3");
  // все три номера заняты → сохранять нечего
  await expect(
    page.locator("button", { hasText: "Сохранить" })
  ).toBeDisabled();
  await expect(page.locator(".exam-preview-row")).toHaveCount(3);
});

test("5. шпаргалка: только ready-билеты, формула отрендерена", async ({
  page,
}) => {
  await loginDemo(page);
  await page.goto(`${EXAM_BASE}/cheatsheet`);
  await expect(page.locator(".exam-cheatsheet-ticket")).toHaveCount(2);
  await expect(
    page.locator(".exam-cheatsheet-ticket").first().locator("math-div.math-render")
  ).toBeVisible({ timeout: 10000 });
});

test("6. сайдбар: строка «Экзамен N/M» в ветке курса", async ({ page }) => {
  await loginDemo(page);
  await page.goto("/s/demo/math-analysis");
  const branch = page.locator(".sidebar-course", {
    hasText: "Математический анализ",
  });
  await branch.locator(".sidebar-course-toggle").dispatchEvent("click");
  const examRow = branch.locator(".sidebar-exam-row");
  await expect(examRow).toBeVisible();
  await expect(examRow.locator(".sidebar-exam-count")).toHaveText("2/8");
});

test("7. дашборд: блок «экзамен скоро» скрыт без даты экзамена", async ({
  page,
}) => {
  await loginDemo(page);
  await page.goto("/s/demo");
  await expect(page.locator(".resume-block")).toBeVisible();
  await expect(page.locator(".resume-label")).not.toContainText("Экзамен через");
  await expect(page.locator(".resume-label")).not.toContainText("Экзамен сегодня");
});

test("8. билет: empty → draft (автосейв) → ready (кнопка)", async ({
  page,
  request,
}) => {
  await loginDemo(page);

  // билет #4 сейчас empty
  await page.goto(`${EXAM_BASE}/4/edit`);
  await page.locator(".editor-inline .tiptap").click();
  await page.keyboard.type("Черновой ответ на билет №4.");
  await expect(page.locator(".save-indicator.saved")).toBeVisible({
    timeout: 10000,
  });

  // статус сам стал draft — на карте чипов теперь 2 draft
  await page.goto(EXAM_BASE);
  await expect(page.locator(".exam-chip.draft")).toHaveCount(2);

  // ручное повышение до ready
  await page.goto(`${EXAM_BASE}/4/edit`);
  const readyBtn = page.locator("button", { hasText: /Отметить готовым|Готов/ });
  await readyBtn.click();
  await expect(page.locator("button", { hasText: "Готов" })).toBeDisabled();

  await restoreTicket(request, 4);
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
