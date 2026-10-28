/**
 * ============================================
 *  tests/hooks-contract.spec.ts — договор хуков pb_hooks (без браузера)
 * ============================================
 *
 * Страховка перед рефакторингом хуков: фиксирует статусы и тексты ответов, на которые опираются клиент и другие спеки.
 *  - неизвестные id в маршрутах групп, экзаменов, подгрупп, билетов, лекций и корзины: статус и текст;
 *  - `POST /api/groups/{id}/leave` с неизвестным id: стандартный ответ PocketBase (в обработчике нет try/catch, это текущее поведение);
 *  - корзина: удаление, восстановление, стирание, очистка и ночная задача `trash_purge` (нужен суперпользователь песочницы:
 *    SUPER_EMAIL/SUPER_PASS; задача стирает всё старое во всей базе, поэтому без этих переменных спек пропускается).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { PB, createCourse, createLecture, h, register, superToken, uid, type Session } from "./group-api";

const MISSING = "zzzzzzzzzzzzzzz";

test.describe("неизвестные id: статус и текст ответа", () => {
  let a: Session;
  test.beforeAll(async ({ request }) => {
    a = await register(request, "ct");
  });

  const send = (request: APIRequestContext, method: string, url: string, data: unknown = {}) =>
    request.fetch(`${PB}${url}`, { method, headers: h(a), data: method === "GET" || method === "DELETE" ? undefined : data });

  const CASES: [string, string, string, number, string][] = [
    // [название, метод, адрес, статус, текст]
    ["группа: kick", "POST", `/api/groups/${MISSING}/kick`, 404, "Группа не найдена."],
    ["группа: invite", "GET", `/api/groups/${MISSING}/invite`, 404, "Группа не найдена."],
    ["группа: invite/reset", "POST", `/api/groups/${MISSING}/invite/reset`, 404, "Группа не найдена."],
    ["группа: invite/enable", "POST", `/api/groups/${MISSING}/invite/enable`, 404, "Группа не найдена."],
    ["группа: transfer", "POST", `/api/groups/${MISSING}/transfer`, 404, "Группа не найдена."],
    ["группа: restore-access", "POST", `/api/groups/${MISSING}/restore-access`, 404, "Группа не найдена."],
    ["группа: restorable", "GET", `/api/groups/${MISSING}/restorable`, 404, "Группа не найдена."],
    ["группа: roster", "GET", `/api/groups/${MISSING}/roster`, 404, "Группа не найдена."],
    ["группа: exams", "GET", `/api/groups/${MISSING}/exams`, 404, "Группа не найдена."],
    ["вступление: неверный код", "POST", "/api/groups/join", 404, "Группа с таким кодом не найдена."],
    ["предпросмотр: неверный код", "GET", "/api/groups/preview?code=zzzz9999", 404, "Группа с таким кодом не найдена."],
    ["экзамен: subgroups", "POST", `/api/exams/${MISSING}/subgroups`, 404, "Экзамен не найден."],
    ["экзамен: group-info", "GET", `/api/exams/${MISSING}/group-info`, 404, "Экзамен не найден."],
    ["экзамен: join-group", "POST", `/api/exams/${MISSING}/join-group`, 404, "Экзамен не найден."],
    ["экзамен: group-match", "GET", `/api/exams/group-match?course=${MISSING}`, 404, "Предмет не найден."],
    ["подгруппа: members", "POST", `/api/subgroups/${MISSING}/members`, 404, "Не найдено."],
    ["подгруппа: leave", "POST", `/api/subgroups/${MISSING}/leave`, 404, "Не найдено."],
    ["подгруппа: tickets", "POST", `/api/subgroups/${MISSING}/tickets`, 404, "Не найдено."],
    ["подгруппа: tickets/bulk", "POST", `/api/subgroups/${MISSING}/tickets/bulk`, 404, "Не найдено."],
    ["подгруппа: distribute", "POST", `/api/subgroups/${MISSING}/distribute`, 404, "Не найдено."],
    ["билет: assign", "POST", `/api/tickets/${MISSING}/assign`, 404, "Не найдено."],
    ["билет: lock", "POST", `/api/tickets/${MISSING}/lock`, 404, "Не найдено."],
    ["билет: unlock", "POST", `/api/tickets/${MISSING}/unlock`, 404, "Не найдено."],
    ["билет: take-my-answer", "POST", `/api/tickets/${MISSING}/take-my-answer`, 404, "Не найдено."],
    ["лекция: share-subgroup", "POST", `/api/lectures/${MISSING}/share-subgroup`, 404, "Лекция не найдена."],
    ["лекция: request-access", "POST", `/api/lectures/${MISSING}/request-access`, 404, "Лекция не найдена."],
    ["лекция: copy", "POST", `/api/lectures/${MISSING}/copy`, 404, "Лекция не найдена."],
    ["запрос доступа: resolve", "POST", `/api/access-requests/${MISSING}/resolve`, 404, "Запрос не найден."],
    ["корзина: delete лекции", "POST", "/api/trash/delete", 404, "Лекция не найдена."],
    ["корзина: restore лекции", "POST", "/api/trash/restore", 404, "Лекция не найдена."],
    ["корзина: purge лекции", "POST", "/api/trash/purge", 404, "Лекция не найдена."],
    ["корзина: delete предмета", "POST", "/api/trash/delete", 404, "Предмет не найден."],
    ["корзина: restore предмета", "POST", "/api/trash/restore", 404, "Предмет не найден."],
    ["корзина: purge предмета", "POST", "/api/trash/purge", 404, "Предмет не найден."],
    ["корзина: неизвестный тип", "POST", "/api/trash/delete", 400, "Неизвестный тип."],
  ];
  const body = (name: string) => {
    if (name.startsWith("вступление")) return { code: "zzzz9999" };
    if (name.startsWith("корзина") && name.endsWith("предмета")) return { type: "course", id: MISSING };
    if (name.startsWith("корзина") && name.endsWith("лекции")) return { type: "lecture", id: MISSING };
    if (name.startsWith("корзина")) return { type: "x", id: MISSING };
    return { user: MISSING, source: MISSING, subgroup: MISSING, exam: MISSING, question: "q", questions: ["q"], name: "x", members: [], action: "grant" };
  };

  for (const [name, method, url, status, message] of CASES) {
    test(`${name}: ${status} «${message}»`, async ({ request }) => {
      const r = await send(request, method, url, body(name));
      expect(r.status()).toBe(status);
      expect((await r.json()).message).toBe(message);
    });
  }

  test("выход из группы с неизвестным id: стандартный 404 PocketBase (в обработчике нет try/catch)", async ({ request }) => {
    const r = await send(request, "POST", `/api/groups/${MISSING}/leave`);
    expect(r.status()).toBe(404);
    expect((await r.json()).message).toBe("The requested resource wasn't found.");
  });

  test("снятие доступа подгруппе у неизвестной лекции: 200 {removed}", async ({ request }) => {
    const r = await send(request, "DELETE", `/api/lectures/${MISSING}/share-subgroup/${MISSING}`);
    expect(r.status()).toBe(200);
    expect(Object.keys(await r.json())).toEqual(["removed"]);
  });
});

test.describe("корзина (нужен суперпользователь песочницы)", () => {
  test.skip(!process.env.SUPER_EMAIL, "без SUPER_EMAIL спек не запускается: ночная задача стирает всё старое во всей базе");
  test.describe.configure({ mode: "serial" });

  let a: Session;
  let b: Session;
  let su: string;
  test.beforeAll(async ({ request }) => {
    a = await register(request, "tra");
    b = await register(request, "trb");
    su = (await superToken(request)) as string;
    expect(su, "вход суперпользователя").toBeTruthy();
  });

  const post = (request: APIRequestContext, s: Session, path: string, data: unknown = {}) =>
    request.post(`${PB}/api/trash/${path}`, { headers: h(s), data });
  const exists = async (request: APIRequestContext, collection: string, id: string) =>
    (await request.get(`${PB}/api/collections/${collection}/records/${id}`, { headers: { Authorization: su } })).ok();
  const deletedAt = async (request: APIRequestContext, collection: string, id: string) =>
    String((await (await request.get(`${PB}/api/collections/${collection}/records/${id}`, { headers: { Authorization: su } })).json()).deleted_at ?? "");
  const lectureIn = async (request: APIRequestContext, s: Session, course: string, title: string) =>
    createLecture(request, s, title, { field: course });
  const age = (request: APIRequestContext, collection: string, id: string, at: string) =>
    request.patch(`${PB}/api/collections/${collection}/records/${id}`, { headers: { Authorization: su }, data: { deleted_at: at } });

  test("список корзины: предмет с числом своих лекций, лекции предмета отдельными строками не выходят", async ({ request }) => {
    const course = await createCourse(request, a, `Предмет ${uid()}`);
    const l1 = await lectureIn(request, a, course, `Лекция один ${uid()}`);
    const l2 = await lectureIn(request, a, course, `Лекция два ${uid()}`);
    const single = await createLecture(request, a, `Одиночная ${uid()}`);
    expect((await post(request, a, "delete", { type: "course", id: course })).ok()).toBeTruthy();
    expect((await post(request, a, "delete", { type: "lecture", id: single })).ok()).toBeTruthy();
    const r = await request.get(`${PB}/api/trash`, { headers: h(a) });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.days).toBe(30);
    const items = body.items as { type: string; id: string; lectures: number }[];
    expect(items.find((x) => x.type === "course" && x.id === course)?.lectures).toBe(2);
    expect(items.some((x) => x.id === l1 || x.id === l2), "лекции предмета отдельными строками").toBe(false);
    expect(items.find((x) => x.type === "lecture" && x.id === single)).toBeTruthy();
  });

  test("предмет уносит свои лекции; возвращаются именно они, а ранее удалённая отдельно остаётся в корзине", async ({ request }) => {
    const course = await createCourse(request, a, `Предмет ${uid()}`);
    const early = await lectureIn(request, a, course, `Раньше ${uid()}`);
    const kept = await lectureIn(request, a, course, `Вместе ${uid()}`);
    expect((await post(request, a, "delete", { type: "lecture", id: early })).ok()).toBeTruthy();
    const earlyAt = await deletedAt(request, "lectures", early);
    await new Promise((r) => setTimeout(r, 1100));
    expect((await post(request, a, "delete", { type: "course", id: course })).ok()).toBeTruthy();
    const courseAt = await deletedAt(request, "courses", course);
    expect(courseAt).not.toBe("");
    expect(await deletedAt(request, "lectures", kept)).toBe(courseAt);
    expect(await deletedAt(request, "lectures", early), "прежнее время не перезаписано").toBe(earlyAt);

    expect((await post(request, a, "restore", { type: "course", id: course })).ok()).toBeTruthy();
    expect(await deletedAt(request, "courses", course)).toBe("");
    expect(await deletedAt(request, "lectures", kept)).toBe("");
    expect(await deletedAt(request, "lectures", early), "лекция, удалённая раньше, осталась в корзине").toBe(earlyAt);
  });

  test("возврат лекции возвращает и её предмет, но не другие лекции предмета", async ({ request }) => {
    const course = await createCourse(request, a, `Предмет ${uid()}`);
    const l1 = await lectureIn(request, a, course, `Первая ${uid()}`);
    const l2 = await lectureIn(request, a, course, `Вторая ${uid()}`);
    expect((await post(request, a, "delete", { type: "course", id: course })).ok()).toBeTruthy();
    expect((await post(request, a, "restore", { type: "lecture", id: l1 })).ok()).toBeTruthy();
    expect(await deletedAt(request, "lectures", l1)).toBe("");
    expect(await deletedAt(request, "courses", course), "предмет вернулся вместе с лекцией").toBe("");
    expect(await deletedAt(request, "lectures", l2), "соседняя лекция осталась в корзине").not.toBe("");
  });

  test("purge: чужое — 403, не в корзине — 400, свои лекции и предмет стираются насовсем", async ({ request }) => {
    const course = await createCourse(request, a, `Предмет ${uid()}`);
    const inCourse = await lectureIn(request, a, course, `В предмете ${uid()}`);
    const single = await createLecture(request, a, `Одиночная ${uid()}`);

    const foreign = await post(request, b, "purge", { type: "lecture", id: single });
    expect(foreign.status()).toBe(403);
    expect((await foreign.json()).message).toBe("Это не твоя лекция.");
    const foreignCourse = await post(request, b, "purge", { type: "course", id: course });
    expect(foreignCourse.status()).toBe(403);
    expect((await foreignCourse.json()).message).toBe("Это не твой предмет.");
    const notTrashed = await post(request, a, "purge", { type: "lecture", id: single });
    expect(notTrashed.status()).toBe(400);
    expect((await notTrashed.json()).message).toBe("Сначала положи в корзину.");
    const notTrashedCourse = await post(request, a, "purge", { type: "course", id: course });
    expect(notTrashedCourse.status()).toBe(400);
    expect((await notTrashedCourse.json()).message).toBe("Сначала положи в корзину.");

    expect((await post(request, a, "delete", { type: "lecture", id: single })).ok()).toBeTruthy();
    expect((await post(request, a, "purge", { type: "lecture", id: single })).ok()).toBeTruthy();
    expect(await exists(request, "lectures", single)).toBe(false);

    expect((await post(request, a, "delete", { type: "course", id: course })).ok()).toBeTruthy();
    expect((await post(request, a, "purge", { type: "course", id: course })).ok()).toBeTruthy();
    expect(await exists(request, "courses", course)).toBe(false);
    expect(await exists(request, "lectures", inCourse), "лекция предмета стёрта вместе с ним").toBe(false);
  });

  test("delete и restore: чужое — 403 с текстом", async ({ request }) => {
    const course = await createCourse(request, a, `Предмет ${uid()}`);
    const single = await createLecture(request, a, `Одиночная ${uid()}`);
    for (const path of ["delete", "restore"]) {
      const l = await post(request, b, path, { type: "lecture", id: single });
      expect([l.status(), (await l.json()).message]).toEqual([403, "Это не твоя лекция."]);
      const c = await post(request, b, path, { type: "course", id: course });
      expect([c.status(), (await c.json()).message]).toEqual([403, "Это не твой предмет."]);
    }
  });

  test("empty: стирает всё своё из корзины (и лекции предметов), чужую корзину и живые записи не трогает", async ({ request }) => {
    const course = await createCourse(request, a, `Предмет ${uid()}`);
    const inCourse = await lectureIn(request, a, course, `В предмете ${uid()}`);
    const single = await createLecture(request, a, `Одиночная ${uid()}`);
    const alive = await createLecture(request, a, `Живая ${uid()}`);
    const theirs = await createLecture(request, b, `Чужая ${uid()}`);
    expect((await post(request, a, "delete", { type: "course", id: course })).ok()).toBeTruthy();
    expect((await post(request, a, "delete", { type: "lecture", id: single })).ok()).toBeTruthy();
    expect((await post(request, b, "delete", { type: "lecture", id: theirs })).ok()).toBeTruthy();

    const r = await post(request, a, "empty");
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(await exists(request, "courses", course)).toBe(false);
    expect(await exists(request, "lectures", inCourse)).toBe(false);
    expect(await exists(request, "lectures", single)).toBe(false);
    expect(await exists(request, "lectures", alive), "живая лекция").toBe(true);
    expect(await exists(request, "lectures", theirs), "чужая корзина").toBe(true);
  });

  test("ночная задача trash_purge: стирает записи старше 30 дней (предмет с лекциями), свежие и живые остаются", async ({ request }) => {
    const oldCourse = await createCourse(request, a, `Старый предмет ${uid()}`);
    const oldCourseLecture = await lectureIn(request, a, oldCourse, `В старом ${uid()}`);
    const oldLecture = await createLecture(request, a, `Старая ${uid()}`);
    const freshLecture = await createLecture(request, a, `Свежая ${uid()}`);
    const alive = await createLecture(request, a, `Живая ${uid()}`);
    for (const id of [oldLecture, freshLecture]) expect((await post(request, a, "delete", { type: "lecture", id })).ok()).toBeTruthy();
    expect((await post(request, a, "delete", { type: "course", id: oldCourse })).ok()).toBeTruthy();
    expect((await age(request, "lectures", oldLecture, "2020-01-01 00:00:00.000Z")).ok()).toBeTruthy();
    expect((await age(request, "courses", oldCourse, "2020-01-01 00:00:00.000Z")).ok()).toBeTruthy();

    const run = await request.post(`${PB}/api/crons/trash_purge`, { headers: { Authorization: su } });
    expect(run.status(), await run.text()).toBe(204);
    await expect.poll(() => exists(request, "lectures", oldLecture)).toBe(false);
    expect(await exists(request, "courses", oldCourse)).toBe(false);
    expect(await exists(request, "lectures", oldCourseLecture), "лекция старого предмета").toBe(false);
    expect(await exists(request, "lectures", freshLecture), "свежая в корзине").toBe(true);
    expect(await exists(request, "lectures", alive), "живая").toBe(true);
  });
});
