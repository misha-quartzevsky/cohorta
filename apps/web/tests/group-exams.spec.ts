/**
 * Волна C, этап 1б: экзамены группы, подгруппы, билеты подгруппы, блокировка «Занят».
 * API-тесты на тестовых аккаунтах (без браузера). Запуск — как у group-access.spec.ts.
 */
import { test, expect } from "@playwright/test";
import {
  PB, h, register, groupWith, createLecture, createCourse, createExam, createTicket, canGet, list,
  grantShare, cleanup, superToken, type Session,
} from "./group-api";

test.describe.configure({ mode: "serial" });

test.describe("экзамены группы и подгруппы", () => {
  let a: Session; // владелец группы и экзамена, в подгруппе 1
  let b: Session; // подгруппа 1
  let c: Session; // подгруппа 2
  let d: Session; // участник группы вне подгрупп
  let x: Session; // посторонний, не в группе
  let g = "";
  let exam = "";
  let s1 = "";
  let s2 = "";
  const common: string[] = [];
  let sub1Tickets: Record<string, any>[] = [];

  test.beforeAll(async ({ request }) => {
    [a, b, c, d, x] = await Promise.all(["a", "b", "c", "d", "x"].map((t) => register(request, t)));
    g = (await groupWith(request, a, [b, c, d])).id;
    const course = await createCourse(request, a, "Философия");
    exam = await createExam(request, a, course, g);
    for (let i = 1; i <= 3; i += 1) common.push(await createTicket(request, a, exam, i, `Вопрос ${i}`));
  });

  test.afterAll(async ({ request }) => cleanup(request, [a, b, c, d, x], [g]));

  test("участник группы создаёт подгруппу; билеты общего списка копируются в неё", async ({ request }) => {
    const r = await request.post(`${PB}/api/exams/${exam}/subgroups`, { headers: h(a), data: { name: "Девчонки", members: [b.id] } });
    expect(r.ok(), await r.text()).toBeTruthy();
    s1 = (await r.json()).id;
    sub1Tickets = (await list(request, a, "exam_tickets", `subgroup="${s1}"`)).sort((p, q) => p.number - q.number);
    expect(sub1Tickets.map((t) => t.question)).toEqual(["Вопрос 1", "Вопрос 2", "Вопрос 3"]);
    expect((await list(request, b, "exam_tickets", `subgroup="${s1}"`)).length).toBe(3);
    // добавленный в подгруппу видит это в данных для уведомлений (по времени «последний раз смотрел»)
    const note = await (
      await request.get(`${PB}/api/group/notifications`, { headers: h(b), params: { since: new Date(Date.now() - 60_000).toISOString() } })
    ).json();
    expect(note.subgroups.some((x: any) => x.subgroup === s1 && x.name === "Девчонки")).toBe(true);
    expect((await (await request.get(`${PB}/api/group/notifications`, { headers: h(d), params: { since: new Date(Date.now() - 60_000).toISOString() } })).json()).subgroups).toEqual([]);
    // создать подгруппу может только участник группы, экзамен которой это
    const outsider = await request.post(`${PB}/api/exams/${exam}/subgroups`, { headers: h(x), data: { name: "Чужие", members: [] } });
    expect(outsider.status()).toBe(404);
    // экзамен «в чужой группе» создать нельзя (участником которой ты не являешься)
    const xc = await createCourse(request, x, "Философия");
    const foreign = await request.post(`${PB}/api/collections/exams/records`, {
      headers: h(x),
      data: { course: xc, owner: x.id, title: "Экзамен", group: g, mode: "group" },
    });
    expect(foreign.ok(), "экзамен в группе, где ты не состоишь").toBeFalsy();
    // подгруппы напрямую через API не создаются
    const direct = await request.post(`${PB}/api/collections/exam_subgroups/records`, { headers: h(a), data: { exam, name: "прямая" } });
    expect(direct.ok(), "создание подгруппы в обход маршрута").toBeFalsy();
  });

  test("подгруппу и её билеты видят только участники; посторонний даже не знает, что она есть", async ({ request }) => {
    for (const s of [c, d, x]) {
      expect(await list(request, s, "exam_subgroups"), "список подгрупп").toEqual([]);
      expect(await canGet(request, s, "exam_subgroups", s1), "подгруппа по id").toBe(false);
      expect((await list(request, s, "exam_tickets", `subgroup="${s1}"`)).length, "билеты подгруппы").toBe(0);
      for (const t of sub1Tickets) expect(await canGet(request, s, "exam_tickets", t.id), "билет по id").toBe(false);
      expect((await list(request, s, "exam_participants", `subgroup="${s1}"`)).length, "состав").toBe(0);
    }
    // действия над чужой подгруппой отвечают 404, как будто её нет
    for (const s of [c, d, x]) {
      expect((await request.post(`${PB}/api/subgroups/${s1}/members`, { headers: h(s), data: { user: s.id } })).status()).toBe(404);
      expect((await request.post(`${PB}/api/subgroups/${s1}/leave`, { headers: h(s) })).status()).toBe(404);
      expect((await request.post(`${PB}/api/subgroups/${s1}/tickets`, { headers: h(s), data: { question: "?" } })).status()).toBe(404);
      expect((await request.post(`${PB}/api/tickets/${sub1Tickets[0].id}/lock`, { headers: h(s) })).status()).toBe(404);
    }
    // участник видит состав и подгруппу
    expect((await list(request, b, "exam_subgroups")).map((r) => r.id)).toEqual([s1]);
    expect((await list(request, b, "exam_participants", `subgroup="${s1}"`)).length).toBe(2);
    // экзамен группы виден участникам группы, не постороннему
    expect(await canGet(request, d, "exams", exam)).toBe(true);
    expect(await canGet(request, x, "exams", exam)).toBe(false);
  });

  test("один человек не может быть в двух подгруппах одного экзамена", async ({ request }) => {
    const two = await request.post(`${PB}/api/exams/${exam}/subgroups`, { headers: h(c), data: { name: "Вторая", members: [b.id] } });
    expect(two.status()).toBe(409);
    expect((await two.json()).code).toBe("already_in_subgroup");
    const ok = await request.post(`${PB}/api/exams/${exam}/subgroups`, { headers: h(c), data: { name: "Вторая", members: [] } });
    expect(ok.ok(), await ok.text()).toBeTruthy();
    s2 = (await ok.json()).id;
    // пригласить в первую того, кто уже во второй
    const inv = await request.post(`${PB}/api/subgroups/${s1}/members`, { headers: h(a), data: { user: c.id } });
    expect(inv.status()).toBe(409);
    // уже состоящего приглашать нельзя; участника вне группы нельзя
    expect((await request.post(`${PB}/api/subgroups/${s1}/members`, { headers: h(a), data: { user: b.id } })).status()).toBe(409);
    expect((await request.post(`${PB}/api/subgroups/${s1}/members`, { headers: h(a), data: { user: x.id } })).status()).toBe(400);
    // в обход маршрутов: строку участника напрямую создать/переставить нельзя
    const row = await request.post(`${PB}/api/collections/exam_participants/records`, { headers: h(a), data: { exam, user: d.id, subgroup: s1 } });
    expect(row.ok(), "прямое добавление в подгруппу").toBeFalsy();
    const row2 = await request.post(`${PB}/api/collections/exam_participants/records`, { headers: h(a), data: { exam, user: d.id } });
    expect(row2.ok(), "прямое добавление участника в экзамен группы").toBeFalsy();
    const mine = (await list(request, b, "exam_participants", `user="${b.id}"`))[0];
    const move = await request.patch(`${PB}/api/collections/exam_participants/records/${mine.id}`, { headers: h(b), data: { subgroup: s2 } });
    expect(move.ok(), "перенос в другую подгруппу правкой").toBeFalsy();
    // на уровне базы: уникальный индекс (exam, user) — вторую строку не создать даже суперпользователю
    const su = await superToken(request);
    if (su) {
      const dup = await request.post(`${PB}/api/collections/exam_participants/records`, {
        headers: { Authorization: su },
        data: { exam, user: b.id, subgroup: s2 },
      });
      expect(dup.ok(), "вторая строка участника в базе").toBeFalsy();
    }
  });

  test("список экзаменов группы и экзамен: предмет автора, только своя подгруппа, чужих не видно", async ({ request }) => {
    const rows = await (await request.get(`${PB}/api/groups/${g}/exams`, { headers: h(d) })).json();
    expect(rows.map((r: any) => r.id)).toEqual([exam]);
    expect(rows[0].title).toBe("Философия"); // название предмета автора видно участнику группы
    expect(rows[0].my_subgroup).toBeNull();
    const mineA = await (await request.get(`${PB}/api/groups/${g}/exams`, { headers: h(a) })).json();
    expect(mineA[0].my_subgroup).toEqual({ id: s1, name: "Девчонки" });
    // участник другой подгруппы своей видит только свою, число подгрупп нигде не отдаётся
    const mineC = await (await request.get(`${PB}/api/groups/${g}/exams`, { headers: h(c) })).json();
    expect(mineC[0].my_subgroup).toEqual({ id: s2, name: "Вторая" });
    expect(JSON.stringify(mineC)).not.toContain("Девчонки");
    // посторонний: 404, как будто группы нет
    expect((await request.get(`${PB}/api/groups/${g}/exams`, { headers: h(x) })).status()).toBe(404);
    expect((await request.get(`${PB}/api/exams/${exam}/group-info`, { headers: h(x) })).status()).toBe(404);
    // «уже в подгруппе»: id людей, без названий подгрупп
    const info = await (await request.get(`${PB}/api/exams/${exam}/group-info`, { headers: h(d) })).json();
    expect(info.exam.id).toBe(exam);
    expect([...info.taken].sort()).toEqual([a.id, b.id, c.id].sort());
    expect(JSON.stringify(info)).not.toContain("Девчонки");
    expect(JSON.stringify(info)).not.toContain("Вторая");
  });

  test("импорт списка билетов в подгруппу: номера после существующих, порядок текста; посторонним и чужой подгруппе отказ", async ({ request }) => {
    const before = await list(request, c, "exam_tickets", `subgroup="${s2}"`);
    expect(before.map((t) => t.number).sort((p, q) => p - q)).toEqual([1, 2, 3]);
    const questions = Array.from({ length: 27 }, (_, i) => `Импорт ${i + 1}`);
    const r = await request.post(`${PB}/api/subgroups/${s2}/tickets/bulk`, { headers: h(c), data: { questions: ["  ", ...questions, ""] } });
    expect(r.ok(), await r.text()).toBeTruthy();
    expect(await r.json()).toMatchObject({ added: 27, first: 4 });
    const after = (await list(request, c, "exam_tickets", `subgroup="${s2}"`)).sort((p, q) => p.number - q.number);
    expect(after).toHaveLength(30);
    expect(after.slice(3).map((t) => t.number)).toEqual(Array.from({ length: 27 }, (_, i) => i + 4));
    expect(after.slice(3).map((t) => t.question)).toEqual(questions); // порядок текста, пустые строки пропущены
    expect(after.slice(3).every((t) => t.status === "empty" && t.subgroup === s2)).toBeTruthy();
    // билеты другой подгруппы и общий список не тронуты
    expect((await list(request, a, "exam_tickets", `subgroup="${s1}"`)).length).toBeGreaterThanOrEqual(3);
    expect((await list(request, a, "exam_tickets", `exam="${exam}" && subgroup=""`)).length).toBe(3);
    // посторонний, участник группы вне подгрупп и участник ЧУЖОЙ подгруппы не импортируют: подгруппа для них не существует
    for (const s of [x, d, a]) {
      const w = await request.post(`${PB}/api/subgroups/${s2}/tickets/bulk`, { headers: h(s), data: { questions: ["взлом"] } });
      expect(w.status(), "импорт без права").toBe(404);
    }
    expect((await list(request, c, "exam_tickets", `subgroup="${s2}"`)).length).toBe(30);
    // пустой и слишком длинный списки
    expect((await request.post(`${PB}/api/subgroups/${s2}/tickets/bulk`, { headers: h(c), data: { questions: ["", "  "] } })).status()).toBe(400);
    expect((await request.post(`${PB}/api/subgroups/${s2}/tickets/bulk`, { headers: h(c), data: { questions: Array.from({ length: 501 }, () => "q") } })).status()).toBe(400);
    // «Добавить билет» нумерует так же (после наибольшего номера подгруппы) и принимает ответ
    const one = await request.post(`${PB}/api/subgroups/${s2}/tickets`, { headers: h(c), data: { question: "Один", answer: "<p>ответ</p>" } });
    expect(one.ok(), await one.text()).toBeTruthy();
    expect((await one.json()).number).toBe(31);
    const rec = (await list(request, c, "exam_tickets", `subgroup="${s2}" && number=31`))[0];
    expect(rec.status).toBe("draft");
    // прямая запись билета в чужую подгруппу обходом маршрута тоже закрыта
    const direct = await request.post(`${PB}/api/collections/exam_tickets/records`, { headers: h(d), data: { exam, number: 99, question: "обход", subgroup: s2, status: "empty" } });
    expect(direct.ok(), "создание билета подгруппы напрямую").toBeFalsy();
  });

  test("блокировка «Занят» проверяется на сервере", async ({ request }) => {
    const t = sub1Tickets[0].id;
    const take = await request.post(`${PB}/api/tickets/${t}/lock`, { headers: h(a) });
    expect(take.ok(), await take.text()).toBeTruthy();
    // другой участник: занято и по маршруту, и при записи билета
    const busy = await request.post(`${PB}/api/tickets/${t}/lock`, { headers: h(b) });
    expect(busy.status()).toBe(409);
    expect((await busy.json()).code).toBe("busy");
    const write = await request.patch(`${PB}/api/collections/exam_tickets/records/${t}`, { headers: h(b), data: { answer: "<p>от Б</p>" } });
    expect(write.ok(), "запись билета, занятого другим").toBeFalsy();
    expect((await list(request, a, "exam_tickets", `id="${t}"`))[0].answer ?? "").toBe("");
    // владелец блокировки пишет и продлевает её
    const mine = await request.patch(`${PB}/api/collections/exam_tickets/records/${t}`, { headers: h(a), data: { answer: "<p>от А</p>", status: "draft" } });
    expect(mine.ok(), await mine.text()).toBeTruthy();
    // блокировку нельзя выставить правкой через API
    for (const body of [{ locked_by: b.id }, { locked_until: "2099-01-01 00:00:00.000Z" }, { assignees: [b.id] }, { subgroup: s2 }]) {
      const f = await request.patch(`${PB}/api/collections/exam_tickets/records/${t}`, { headers: h(a), data: body });
      expect(f.ok(), `правка служебного поля ${Object.keys(body)[0]}`).toBeFalsy();
    }
    // «Занят» снимает «Отпустить»
    expect((await request.post(`${PB}/api/tickets/${t}/unlock`, { headers: h(b) })).ok()).toBeTruthy(); // чужой — без эффекта
    expect((await request.post(`${PB}/api/tickets/${t}/lock`, { headers: h(b) })).status()).toBe(409);
    expect((await request.post(`${PB}/api/tickets/${t}/unlock`, { headers: h(a) })).ok()).toBeTruthy();
    expect((await request.post(`${PB}/api/tickets/${t}/lock`, { headers: h(b) })).ok()).toBeTruthy();
    // 30 секунд без действий: просроченную блокировку может занять другой
    const su = await superToken(request);
    if (su) {
      await request.patch(`${PB}/api/collections/exam_tickets/records/${t}`, {
        headers: { Authorization: su },
        data: { locked_until: "2020-01-01 00:00:00.000Z" },
      });
      const after = await request.patch(`${PB}/api/collections/exam_tickets/records/${t}`, { headers: h(a), data: { answer: "<p>снова А</p>" } });
      expect(after.ok(), "запись после истечения блокировки: " + (await after.text())).toBeTruthy();
      const rec = (await list(request, a, "exam_tickets", `id="${t}"`))[0];
      expect(rec.locked_by).toBe(a.id);
    }
    // посторонний билет не пишет вовсе
    for (const s of [c, d, x]) {
      const w = await request.patch(`${PB}/api/collections/exam_tickets/records/${t}`, { headers: h(s), data: { answer: "<p>взлом</p>" } });
      expect(w.ok(), "запись чужой подгруппы").toBeFalsy();
    }
  });

  test("«Взять мой ответ» заменяет текст билета, пока он не занят другим", async ({ request }) => {
    const bc = await createCourse(request, b, "Философия");
    const bExam = await createExam(request, b, bc);
    const mineT = await createTicket(request, b, bExam, 1, "Вопрос 2", { answer: "<p>мой ответ</p>", status: "draft" });
    const t = sub1Tickets[1].id;
    const r = await request.post(`${PB}/api/tickets/${t}/take-my-answer`, { headers: h(b), data: { source: mineT } });
    expect(r.ok(), await r.text()).toBeTruthy();
    expect((await list(request, a, "exam_tickets", `id="${t}"`))[0].answer).toBe("<p>мой ответ</p>");
    // билет теперь занят Б: А не может его перезаписать
    const busy = await request.post(`${PB}/api/tickets/${t}/take-my-answer`, { headers: h(a), data: { source: mineT } });
    expect(busy.status()).toBe(409);
    // чужой личный билет взять нельзя
    expect((await request.post(`${PB}/api/tickets/${sub1Tickets[2].id}/take-my-answer`, { headers: h(a), data: { source: mineT } })).status()).toBe(400);
  });

  test("в общем списке экзамена группы чужих ответов нет; билеты подгруппы раздаются поровну", async ({ request }) => {
    await request.patch(`${PB}/api/collections/exam_tickets/records/${common[0]}`, { headers: h(a), data: { answer: "<p>ответ владельца</p>" } });
    expect((await list(request, d, "exam_tickets", `id="${common[0]}"`))[0].answer ?? "").toBe("");
    expect((await list(request, b, "exam_tickets", `id="${common[0]}"`))[0].answer ?? "").toBe("");
    expect((await list(request, a, "exam_tickets", `id="${common[0]}"`))[0].answer).toContain("ответ владельца");
    // даже участник, прошедший «доказательство знания» (свой назначенный билет с ответом), чужих ответов в общем списке не видит
    expect((await request.patch(`${PB}/api/collections/exam_tickets/records/${common[2]}`, { headers: h(a), data: { author: d.id } })).ok()).toBeTruthy();
    const own = await request.patch(`${PB}/api/collections/exam_tickets/records/${common[2]}`, { headers: h(d), data: { answer: "<p>ответ D</p>" } });
    expect(own.ok(), await own.text()).toBeTruthy();
    expect((await list(request, d, "exam_tickets", `id="${common[0]}"`))[0].answer ?? "", "ответ владельца после PoK").toBe("");
    // участники группы не правят общий список
    const w = await request.patch(`${PB}/api/collections/exam_tickets/records/${common[1]}`, { headers: h(d), data: { question: "взлом" } });
    expect(w.ok()).toBeFalsy();
    const dist = await request.post(`${PB}/api/subgroups/${s1}/distribute`, { headers: h(a) });
    expect(dist.ok(), await dist.text()).toBeTruthy();
    const tickets = await list(request, b, "exam_tickets", `subgroup="${s1}"`);
    const load: Record<string, number> = { [a.id]: 0, [b.id]: 0 };
    for (const t of tickets) for (const u of t.assignees) load[u] += 1;
    expect(Math.abs(load[a.id] - load[b.id])).toBeLessThanOrEqual(1);
    // назначать можно только участника подгруппы
    const bad = await request.post(`${PB}/api/tickets/${sub1Tickets[0].id}/assign`, { headers: h(a), data: { users: [c.id] } });
    expect(bad.status()).toBe(400);
  });

  test("личный экзамен присоединяется к групповому по названию предмета (без регистра и пробелов)", async ({ request }) => {
    const dc = await createCourse(request, d, "  философия ");
    const dExam = await createExam(request, d, dc);
    const match = await request.get(`${PB}/api/exams/group-match`, { headers: h(d), params: { course: dc } });
    expect((await match.json()).map((m: any) => m.exam)).toEqual([exam]);
    const other = await createCourse(request, d, "Химия");
    expect(await (await request.get(`${PB}/api/exams/group-match`, { headers: h(d), params: { course: other } })).json()).toEqual([]);
    // посторонний ничего не находит
    const xc = await createCourse(request, x, "Философия");
    expect(await (await request.get(`${PB}/api/exams/group-match`, { headers: h(x), params: { course: xc } })).json()).toEqual([]);
    const j = await request.post(`${PB}/api/exams/${dExam}/join-group`, { headers: h(d), data: { exam } });
    expect(j.ok(), await j.text()).toBeTruthy();
    const mine = await list(request, d, "exam_tickets", `exam="${dExam}"`);
    expect(mine.map((t) => t.question).sort()).toEqual(["Вопрос 1", "Вопрос 2", "Вопрос 3"]);
    expect(mine.every((t) => !t.answer)).toBeTruthy(); // ответы у каждого свои
    const chem = await createExam(request, d, other);
    expect((await request.post(`${PB}/api/exams/${chem}/join-group`, { headers: h(d), data: { exam } })).status()).toBe(400);
    expect((await request.post(`${PB}/api/exams/${dExam}/join-group`, { headers: h(x), data: { exam } })).status()).toBe(404);
  });

  test("доступ подгруппе: новые участники получают его автоматически, вышедшие теряют", async ({ request }) => {
    const lecture = await createLecture(request, a, "Лекция для подгруппы");
    expect(await canGet(request, b, "lectures", lecture)).toBe(false);
    const r = await request.post(`${PB}/api/lectures/${lecture}/share-subgroup`, { headers: h(a), data: { subgroup: s1, allow_copy: true } });
    expect(r.ok(), await r.text()).toBeTruthy();
    expect(await canGet(request, b, "lectures", lecture)).toBe(true);
    expect(await canGet(request, d, "lectures", lecture)).toBe(false);
    // не участник подгруппы не может выдать доступ ей
    const other = await createLecture(request, d, "Чужая лекция");
    expect((await request.post(`${PB}/api/lectures/${other}/share-subgroup`, { headers: h(d), data: { subgroup: s1 } })).status()).toBe(404);
    // новый участник
    expect((await request.post(`${PB}/api/subgroups/${s1}/members`, { headers: h(a), data: { user: d.id } })).ok()).toBeTruthy();
    expect(await canGet(request, d, "lectures", lecture)).toBe(true);
    // вышел — потерял доступ и билеты
    expect((await request.post(`${PB}/api/subgroups/${s1}/leave`, { headers: h(d) })).ok()).toBeTruthy();
    expect(await canGet(request, d, "lectures", lecture)).toBe(false);
    expect(await canGet(request, d, "exam_tickets", sub1Tickets[0].id)).toBe(false);
    // автор снимает доступ подгруппе
    expect((await request.delete(`${PB}/api/lectures/${lecture}/share-subgroup/${s1}`, { headers: h(a) })).ok()).toBeTruthy();
    expect(await canGet(request, b, "lectures", lecture)).toBe(false);
  });

  test("исключённый из группы не получает билеты подгруппы; пустая подгруппа исчезает", async ({ request }) => {
    expect(await canGet(request, c, "exam_tickets", (await list(request, c, "exam_tickets", `subgroup="${s2}"`))[0].id)).toBe(true);
    // исключить может только владелец
    expect((await request.post(`${PB}/api/groups/${g}/kick`, { headers: h(b), data: { user: c.id } })).status()).toBe(403);
    expect((await request.post(`${PB}/api/groups/${g}/kick`, { headers: h(a), data: { user: a.id } })).status()).toBe(400);
    const s2Tickets = await list(request, c, "exam_tickets", `subgroup="${s2}"`);
    const kick = await request.post(`${PB}/api/groups/${g}/kick`, { headers: h(a), data: { user: c.id } });
    expect(kick.ok(), await kick.text()).toBeTruthy();
    for (const t of s2Tickets) expect(await canGet(request, c, "exam_tickets", t.id), "билет после исключения").toBe(false);
    expect(await list(request, c, "exam_tickets", `subgroup="${s2}"`)).toEqual([]);
    expect(await canGet(request, c, "exam_subgroups", s2)).toBe(false);
    expect(await canGet(request, c, "exams", exam), "экзамен группы после исключения").toBe(false);
    // выбывший из подгруппы 1 по выходу из группы тоже теряет билеты
    const leave = await request.post(`${PB}/api/groups/${g}/leave`, { headers: h(b), data: { remember: true } });
    expect(leave.ok(), await leave.text()).toBeTruthy();
    expect(await list(request, b, "exam_tickets", `subgroup="${s1}"`)).toEqual([]);
  });
});
