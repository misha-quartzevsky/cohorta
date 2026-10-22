/**
 * Волна C: личный экзамен и экзамен группы. Что есть сегодня (без новых полей): присоединение копирует в личный экзамен
 * недостающие билеты общего списка (`/api/exams/{id}/join-group`), ответы у каждого свои. Эти тесты фиксируют то,
 * что обязано оставаться правдой при любом развитии связи: личные ответы не видны группе, присоединение их не трогает,
 * выход из группы или подгруппы личный экзамен не ломает.
 */
import { test, expect } from "@playwright/test";
import { PB, h, register, groupWith, createCourse, createExam, createTicket, canGet, list, cleanup, type Session } from "./group-api";

test.describe.configure({ mode: "serial" });

test.describe("личный экзамен и экзамен группы", () => {
  let a: Session; // владелец группы и группового экзамена
  let b: Session; // участник с личным экзаменом
  let c: Session; // другой участник
  let x: Session; // посторонний
  let g = "";
  let groupExam = "";
  let mineExam = "";
  let mineT1 = "";
  let sub = "";

  test.beforeAll(async ({ request }) => {
    [a, b, c, x] = await Promise.all(["a", "b", "c", "x"].map((t) => register(request, `lk-${t}`)));
    g = (await groupWith(request, a, [b, c])).id;
    const course = await createCourse(request, a, "Философия");
    groupExam = await createExam(request, a, course, g);
    for (let i = 1; i <= 4; i += 1) await createTicket(request, a, groupExam, i, `Групповой вопрос ${i}`);
    // у b уже есть личный экзамен по тому же предмету: билет 1 с ответом, билет 2 с ответом, свои формулировки
    const bc = await createCourse(request, b, " философия ");
    mineExam = await createExam(request, b, bc);
    mineT1 = await createTicket(request, b, mineExam, 1, "Мой вопрос 1", { answer: "<p>мой ответ 1</p>", status: "draft" });
    await createTicket(request, b, mineExam, 2, "Мой вопрос 2", { answer: "<p>мой ответ 2</p>", status: "ready" });
  });
  test.afterAll(async ({ request }) => cleanup(request, [a, b, c, x], [g]));

  test("присоединение не теряет мои билеты и ответы и не затирает мои формулировки; повторное ничего не дублирует", async ({ request }) => {
    const j = await request.post(`${PB}/api/exams/${mineExam}/join-group`, { headers: h(b), data: { exam: groupExam } });
    expect(j.ok(), await j.text()).toBeTruthy();
    expect((await j.json()).added).toBe(2); // добавлены только недостающие номера 3 и 4
    const mine = (await list(request, b, "exam_tickets", `exam="${mineExam}"`)).sort((p, q) => p.number - q.number);
    expect(mine.map((t) => t.number)).toEqual([1, 2, 3, 4]);
    expect(mine[0]).toMatchObject({ question: "Мой вопрос 1", answer: "<p>мой ответ 1</p>", status: "draft" });
    expect(mine[1]).toMatchObject({ question: "Мой вопрос 2", answer: "<p>мой ответ 2</p>", status: "ready" });
    expect(mine[2]).toMatchObject({ question: "Групповой вопрос 3", status: "empty" });
    expect(mine[2].answer ?? "").toBe(""); // ответы группового списка (у владельца) не копируются
    // повторно: ничего нового
    const again = await request.post(`${PB}/api/exams/${mineExam}/join-group`, { headers: h(b), data: { exam: groupExam } });
    expect((await again.json()).added).toBe(0);
    expect((await list(request, b, "exam_tickets", `exam="${mineExam}"`)).length).toBe(4);
  });

  test("личные ответы не видны ни одному участнику группы, ни владельцу группового экзамена, ни постороннему", async ({ request }) => {
    const own = await list(request, b, "exam_tickets", `exam="${mineExam}"`);
    for (const s of [a, c, x]) {
      expect(await list(request, s, "exam_tickets", `exam="${mineExam}"`), "список личных билетов").toEqual([]);
      expect(await canGet(request, s, "exams", mineExam), "личный экзамен по id").toBe(false);
      for (const t of own) expect(await canGet(request, s, "exam_tickets", t.id), "личный билет по id").toBe(false);
      const w = await request.patch(`${PB}/api/collections/exam_tickets/records/${mineT1}`, { headers: h(s), data: { answer: "<p>чужой ответ</p>" } });
      expect(w.ok(), "правка чужого личного ответа").toBeFalsy();
    }
    expect((await list(request, b, "exam_tickets", `id="${mineT1}"`))[0].answer).toBe("<p>мой ответ 1</p>");
    // и «Взять мой ответ» чужой личный билет не берёт
    const s1 = await request.post(`${PB}/api/exams/${groupExam}/subgroups`, { headers: h(c), data: { name: "Подгруппа С", members: [] } });
    sub = (await s1.json()).id;
    const subT = (await list(request, c, "exam_tickets", `subgroup="${sub}"`)).sort((p, q) => p.number - q.number)[0];
    const steal = await request.post(`${PB}/api/tickets/${subT.id}/take-my-answer`, { headers: h(c), data: { source: mineT1 } });
    expect(steal.status(), "чужой личный билет как источник").toBe(400);
    expect((await list(request, c, "exam_tickets", `id="${subT.id}"`))[0].answer ?? "").toBe("");
  });

  test("выход из подгруппы и из группы: личный экзамен, билеты и ответы целы, связь с группой пропадает", async ({ request }) => {
    const invite = await request.post(`${PB}/api/subgroups/${sub}/members`, { headers: h(c), data: { user: b.id } });
    expect(invite.ok(), await invite.text()).toBeTruthy();
    expect(await canGet(request, b, "exam_subgroups", sub)).toBe(true);
    expect((await request.post(`${PB}/api/subgroups/${sub}/leave`, { headers: h(b) })).ok()).toBeTruthy();
    let mine = await list(request, b, "exam_tickets", `exam="${mineExam}"`);
    expect(mine).toHaveLength(4);
    expect(mine.find((t) => t.number === 1)?.answer).toBe("<p>мой ответ 1</p>");
    // из группы
    const left = await request.post(`${PB}/api/groups/${g}/leave`, { headers: h(b), data: { remember: false } });
    expect(left.ok(), await left.text()).toBeTruthy();
    expect(await canGet(request, b, "exams", groupExam), "групповой экзамен после выхода").toBe(false);
    expect((await list(request, b, "exam_tickets", `exam="${groupExam}"`)).length, "билеты группового экзамена").toBe(0);
    expect(await canGet(request, b, "exams", mineExam), "личный экзамен цел").toBe(true);
    mine = await list(request, b, "exam_tickets", `exam="${mineExam}"`);
    expect(mine).toHaveLength(4);
    expect(mine.find((t) => t.number === 2)?.answer).toBe("<p>мой ответ 2</p>");
    // присоединиться к групповому после выхода нельзя
    const again = await request.post(`${PB}/api/exams/${mineExam}/join-group`, { headers: h(b), data: { exam: groupExam } });
    expect(again.status()).toBe(404);
  });
});
