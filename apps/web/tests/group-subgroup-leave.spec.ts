/**
 * Волна C: выход из подгруппы (Screen-group-leave, нижний ряд). Отдельный файл: серийный режим файла
 * group-exams.spec.ts не должен пропускать эти проверки, если там что-то упало раньше.
 */
import { test, expect } from "@playwright/test";
import {
  PB, h, register, groupWith, createLecture, createCourse, createExam, createTicket, canGet, list,
  grantShare, cleanup, superToken, type Session,
} from "./group-api";

test.describe("выход из подгруппы", () => {
  let a: Session; // владелец группы, создаёт экзамен
  let b: Session; // в подгруппе, автор лекций
  let c: Session; // выходит
  let d: Session; // остаётся в подгруппе
  let x: Session; // посторонний
  let g = "";
  let exam = "";
  let sub = "";
  let subTickets: Record<string, any>[] = [];
  let lectureSub = ""; // открыта подгруппе
  let lectureOwn = ""; // открыта лично c

  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => {
    [a, b, c, d, x] = await Promise.all(["a", "b", "c", "d", "x"].map((t) => register(request, `lv-${t}`)));
    g = (await groupWith(request, a, [b, c, d])).id;
    const course = await createCourse(request, a, "Философия");
    exam = await createExam(request, a, course, g);
    for (let i = 1; i <= 3; i += 1) await createTicket(request, a, exam, i, `Вопрос ${i}`);
    const r = await request.post(`${PB}/api/exams/${exam}/subgroups`, { headers: h(b), data: { name: "Девчонки", members: [c.id, d.id] } });
    expect(r.ok(), await r.text()).toBeTruthy();
    sub = (await r.json()).id;
    subTickets = await list(request, b, "exam_tickets", `subgroup="${sub}"`);
    lectureSub = await createLecture(request, b, "Лекция подгруппе");
    lectureOwn = await createLecture(request, b, "Лекция лично c");
    expect((await request.post(`${PB}/api/lectures/${lectureSub}/share-subgroup`, { headers: h(b), data: { subgroup: sub } })).ok()).toBeTruthy();
    expect((await grantShare(request, b, lectureOwn, c, g)).ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => cleanup(request, [a, b, c, d, x], [g]));

  test("до выхода: билеты и лекция подгруппы открыты, личная лекция тоже", async ({ request }) => {
    expect(subTickets).toHaveLength(3);
    expect((await list(request, c, "exam_tickets", `subgroup="${sub}"`)).length).toBe(3);
    expect(await canGet(request, c, "lectures", lectureSub)).toBe(true);
    expect(await canGet(request, c, "lectures", lectureOwn)).toBe(true);
    expect(await canGet(request, d, "lectures", lectureSub)).toBe(true);
  });

  test("посторонний и участник группы вне подгруппы не могут выйти: подгруппы для них нет (404)", async ({ request }) => {
    for (const s of [x, a]) expect((await request.post(`${PB}/api/subgroups/${sub}/leave`, { headers: h(s) })).status()).toBe(404);
    expect((await list(request, b, "exam_participants", `subgroup="${sub}"`)).length).toBe(3);
  });

  test("после выхода билеты подгруппы человеку не отдаются, ни списком, ни по id", async ({ request }) => {
    const r = await request.post(`${PB}/api/subgroups/${sub}/leave`, { headers: h(c) });
    expect(r.ok(), await r.text()).toBeTruthy();
    expect(await list(request, c, "exam_tickets", `subgroup="${sub}"`)).toEqual([]);
    for (const t of subTickets) expect(await canGet(request, c, "exam_tickets", t.id), "билет по id").toBe(false);
    expect(await canGet(request, c, "exam_subgroups", sub), "подгруппа по id").toBe(false);
    expect(await list(request, c, "exam_participants", `subgroup="${sub}"`)).toEqual([]);
    // действия над подгруппой отвечают, как будто её нет
    expect((await request.post(`${PB}/api/subgroups/${sub}/tickets/bulk`, { headers: h(c), data: { questions: ["после выхода"] } })).status()).toBe(404);
    expect((await request.post(`${PB}/api/tickets/${subTickets[0].id}/lock`, { headers: h(c) })).status()).toBe(404);
    // остальные участники по-прежнему видят всё
    expect((await list(request, d, "exam_tickets", `subgroup="${sub}"`)).length).toBe(3);
    expect((await list(request, b, "exam_participants", `subgroup="${sub}"`)).length).toBe(2);
  });

  test("лекция, открытая подгруппе, закрылась; открытая лично осталась", async ({ request }) => {
    expect(await canGet(request, c, "lectures", lectureSub)).toBe(false);
    expect(await canGet(request, c, "lectures", lectureOwn)).toBe(true);
    expect(await canGet(request, d, "lectures", lectureSub)).toBe(true);
  });

  test("из группы человек не вышел; личный экзамен и ответы сохранились", async ({ request }) => {
    expect((await list(request, c, "group_members", `group="${g}" && user="${c.id}"`)).length).toBe(1);
    expect(await canGet(request, c, "groups", g)).toBe(true);
    expect(await canGet(request, c, "exams", exam), "экзамен группы виден").toBe(true);
    const cc = await createCourse(request, c, "Философия");
    const mine = await createExam(request, c, cc);
    const t = await createTicket(request, c, mine, 1, "Мой билет", { answer: "<p>мой ответ</p>", status: "draft" });
    expect((await list(request, c, "exam_tickets", `id="${t}"`))[0].answer).toBe("<p>мой ответ</p>");
    // повторный выход — подгруппы для него больше нет
    expect((await request.post(`${PB}/api/subgroups/${sub}/leave`, { headers: h(c) })).status()).toBe(404);
    expect((await list(request, c, "exam_tickets", `id="${t}"`))[0].answer).toBe("<p>мой ответ</p>");
  });

  test("вернуться можно, если снова пригласят: билеты и лекция подгруппы возвращаются", async ({ request }) => {
    const inv = await request.post(`${PB}/api/subgroups/${sub}/members`, { headers: h(d), data: { user: c.id } });
    expect(inv.ok(), await inv.text()).toBeTruthy();
    expect((await list(request, c, "exam_tickets", `subgroup="${sub}"`)).length).toBe(3);
    expect(await canGet(request, c, "lectures", lectureSub)).toBe(true);
    expect((await request.post(`${PB}/api/subgroups/${sub}/leave`, { headers: h(c) })).ok()).toBeTruthy();
  });

  test("последний вышедший: подгруппа исчезает вместе с билетами, из списков пропадает", async ({ request }) => {
    for (const s of [d, b]) expect((await request.post(`${PB}/api/subgroups/${sub}/leave`, { headers: h(s) })).ok()).toBeTruthy();
    for (const s of [a, b, c, d, x]) {
      expect(await list(request, s, "exam_subgroups"), "список подгрупп").toEqual([]);
      expect(await canGet(request, s, "exam_subgroups", sub)).toBe(false);
    }
    const su = await superToken(request);
    if (su) {
      const rows = await request.get(`${PB}/api/collections/exam_tickets/records`, { headers: { Authorization: su }, params: { filter: `subgroup="${sub}"`, perPage: "50" } });
      expect((await rows.json()).items).toEqual([]);
      const subs = await request.get(`${PB}/api/collections/exam_subgroups/records`, { headers: { Authorization: su }, params: { filter: `id="${sub}"` } });
      expect((await subs.json()).items).toEqual([]);
    }
    // все остались в группе, общий список экзамена цел
    for (const s of [b, c, d]) expect((await list(request, s, "group_members", `group="${g}" && user="${s.id}"`)).length).toBe(1);
    expect((await list(request, a, "exam_tickets", `exam="${exam}" && subgroup=""`)).length).toBe(3);
  });
});

