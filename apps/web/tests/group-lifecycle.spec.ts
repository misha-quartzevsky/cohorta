/**
 * Волна C, этап 1б: выход и исключение, приостановка доступов, доступы по группам,
 * закрытая ссылка, запросы доступа, копирование, теги, данные для уведомлений.
 * API-тесты на тестовых аккаунтах (без браузера).
 */
import { test, expect } from "@playwright/test";
import {
  PB, h, register, createGroup, groupWith, inviteCode, join, createLecture, createCourse, canGet, list,
  grantShare, setPreview, cleanup, superToken, type Session,
} from "./group-api";

test.describe.configure({ mode: "serial" });

test.describe("выход, приостановка и возврат доступов", () => {
  let a: Session; // владелец группы
  let b: Session;
  let e: Session; // посторонний
  let g = "";
  let code = "";
  let la = ""; // лекция A
  let lb = ""; // лекция B

  test.beforeAll(async ({ request }) => {
    [a, b, e] = await Promise.all(["a", "b", "e"].map((t) => register(request, t)));
    const grp = await groupWith(request, a, [b]);
    g = grp.id;
    code = grp.code;
    la = await createLecture(request, a, "Лекция A");
    lb = await createLecture(request, b, "Лекция B");
    expect((await grantShare(request, a, la, b, g, true)).ok()).toBeTruthy();
    expect((await grantShare(request, b, lb, a, g)).ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => cleanup(request, [a, b, e], [g]));

  test("владелец с участниками не может выйти, пока не передаст группу", async ({ request }) => {
    const r = await request.post(`${PB}/api/groups/${g}/leave`, { headers: h(a), data: { remember: true } });
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe("transfer_required");
    expect((await list(request, a, "group_members", `group="${g}" && user="${a.id}"`)).length).toBe(1);
    expect((await request.post(`${PB}/api/groups/${g}/leave`, { headers: h(e) })).status()).toBe(404);
  });

  test("выход: чужие доступы к моим лекциям пропадают сразу, полученные приостановлены; возврат и «Вернуть прежние доступы»", async ({ request }) => {
    expect(await canGet(request, a, "lectures", lb)).toBe(true);
    expect(await canGet(request, b, "lectures", la)).toBe(true);
    const out = await request.post(`${PB}/api/groups/${g}/leave`, { headers: h(b), data: { remember: true } });
    expect(out.ok(), await out.text()).toBeTruthy();
    // автору лекции B больше не читать её; B не читает лекцию A, пока его нет
    expect(await canGet(request, a, "lectures", lb), "лекция выбывшего").toBe(false);
    expect(await canGet(request, b, "lectures", la), "полученный доступ вне группы").toBe(false);
    expect((await list(request, b, "groups")).length).toBe(0);
    // выданные мной сохранены приостановленными, мне — тоже (на случай возвращения)
    const su = await superToken(request);
    if (su) {
      const rows = await (
        await request.get(`${PB}/api/collections/lecture_shares/records`, { headers: { Authorization: su }, params: { filter: `group="${g}"` } })
      ).json();
      expect(rows.items.length).toBe(2);
      expect(rows.items.every((r: any) => r.suspended === true)).toBeTruthy();
    }
    // возврат по коду: полученные включаются сами, выданные мной — по «Вернуть (N)»
    const back = await join(request, b, code);
    expect(back.ok(), await back.text()).toBeTruthy();
    expect((await back.json()).restorable).toBe(1);
    expect(await canGet(request, b, "lectures", la), "полученный доступ вернулся").toBe(true);
    expect(await canGet(request, a, "lectures", lb), "выданные мной сами не восстанавливаются").toBe(false);
    const count = await request.get(`${PB}/api/groups/${g}/restorable`, { headers: h(b) });
    expect((await count.json()).count).toBe(1);
    // предпросмотр после возврата выключен
    const mine = (await list(request, b, "group_members", `group="${g}" && user="${b.id}"`))[0];
    expect(mine.preview_enabled).toBe(false);
    const rest = await request.post(`${PB}/api/groups/${g}/restore-access`, { headers: h(b) });
    expect((await rest.json()).restored).toBe(1);
    expect(await canGet(request, a, "lectures", lb)).toBe(true);
    expect((await request.post(`${PB}/api/groups/${g}/restore-access`, { headers: h(e) })).status()).toBe(404);
  });

  test("выход без галочки «Запомнить»: выданные мной доступы удаляются, возвращать нечего", async ({ request }) => {
    const out = await request.post(`${PB}/api/groups/${g}/leave`, { headers: h(b), data: { remember: false } });
    expect(out.ok()).toBeTruthy();
    const back = await join(request, b, code);
    expect((await back.json()).restorable).toBe(0);
    expect(await canGet(request, b, "lectures", la)).toBe(true);
    expect(await canGet(request, a, "lectures", lb)).toBe(false);
    // повторно выдать можно вручную
    expect((await grantShare(request, b, lb, a, g)).ok()).toBeTruthy();
  });

  test("приостановленный доступ закрывает и квиз лекции", async ({ request }) => {
    const quiz = await request.post(`${PB}/api/collections/quizzes/records`, {
      headers: h(a),
      data: { owner: a.id, lecture: la, source_hash: "x", size: 5, model: "t" },
    });
    expect(quiz.ok(), await quiz.text()).toBeTruthy();
    const qid = (await quiz.json()).id;
    expect(await canGet(request, b, "quizzes", qid)).toBe(true);
    expect((await request.post(`${PB}/api/groups/${g}/leave`, { headers: h(b), data: { remember: true } })).ok()).toBeTruthy();
    expect(await canGet(request, b, "quizzes", qid), "квиз при приостановленном доступе").toBe(false);
    expect((await join(request, b, code)).ok()).toBeTruthy();
    expect(await canGet(request, b, "quizzes", qid)).toBe(true);
  });

  test("исключение: владелец; доступы в обе стороны удаляются и сами не возвращаются", async ({ request }) => {
    expect((await request.post(`${PB}/api/groups/${g}/kick`, { headers: h(b), data: { user: a.id } })).status()).toBe(403);
    const k = await request.post(`${PB}/api/groups/${g}/kick`, { headers: h(a), data: { user: b.id } });
    expect(k.ok(), await k.text()).toBeTruthy();
    expect(await canGet(request, b, "lectures", la)).toBe(false);
    expect(await canGet(request, a, "lectures", lb)).toBe(false);
    const back = await join(request, b, code);
    expect((await back.json()).restorable).toBe(0);
    expect(await canGet(request, b, "lectures", la), "после исключения и возврата доступ не вернулся").toBe(false);
    expect((await list(request, b, "lecture_shares")).length).toBe(0);
  });
});

test.describe("доступы и предпросмотр у каждой группы свои", () => {
  let a: Session; // состоит в двух группах
  let b: Session; // тоже в двух
  let c: Session; // только в группе 2
  let g1 = "";
  let g2 = "";
  let la = "";

  test.beforeAll(async ({ request }) => {
    [a, b, c] = await Promise.all(["a", "b", "c"].map((t) => register(request, t)));
    g1 = (await groupWith(request, a, [b])).id;
    const second = await groupWith(request, b, [a, c]);
    g2 = second.id;
    la = await createLecture(request, a, "Лекция A", { group: g1 });
  });

  test.afterAll(async ({ request }) => cleanup(request, [a, b, c], [g1, g2]));

  test("один и тот же человек получает доступ отдельно в каждой группе; выход из одной не трогает другую", async ({ request }) => {
    expect((await grantShare(request, a, la, b, g1)).ok()).toBeTruthy();
    const second = await grantShare(request, a, la, b, g2);
    expect(second.ok(), await second.text()).toBeTruthy();
    // дубль в той же группе нельзя
    expect((await grantShare(request, a, la, b, g1)).ok()).toBeFalsy();
    // в чужую группу (где автора нет) нельзя
    const lonely = await createGroup(request, c, "Чужая");
    expect((await grantShare(request, a, la, c, lonely.id)).ok(), "группа без автора").toBeFalsy();
    expect(await canGet(request, b, "lectures", la)).toBe(true);
    // B выходит из группы 1: доступ из группы 1 приостановлен, из группы 2 работает
    expect((await request.post(`${PB}/api/groups/${g1}/leave`, { headers: h(b), data: { remember: true } })).ok()).toBeTruthy();
    expect(await canGet(request, b, "lectures", la), "доступ из второй группы остался").toBe(true);
    // A выходит из группы 2 (владелец — B): доступ из группы 2 пропал, из группы 1 B уже вне
    expect((await request.post(`${PB}/api/groups/${g2}/leave`, { headers: h(a), data: { remember: false } })).ok()).toBeTruthy();
    expect(await canGet(request, b, "lectures", la)).toBe(false);
  });

  test("предпросмотр с названием предмета и обложкой: у каждой группы свой", async ({ request }) => {
    const course = await createCourse(request, c, "Статистика");
    const lc = await createLecture(request, c, "Лекция C", { field: course, group: g2 });
    // C состоит только в группе 2; предпросмотр включает для неё
    await setPreview(request, c, g2, true);
    const seen = await list(request, b, "lecture_previews", `lecture="${lc}"`);
    expect(seen.length).toBe(1);
    expect(seen[0].course_title).toBe("Статистика");
    expect(typeof seen[0].cover_seed).toBe("number");
    expect(JSON.stringify(seen[0])).not.toContain("секретный");
    // в группу 1 C не входит, там ничего не видно
    expect(await list(request, a, "lecture_previews", `lecture="${lc}"`)).toEqual([]);
  });
});

test.describe("ссылка-приглашение: открыта или закрыта", () => {
  let a: Session;
  let b: Session;
  let e: Session;
  let g = "";
  let code = "";

  test.beforeAll(async ({ request }) => {
    [a, b, e] = await Promise.all(["a", "b", "e"].map((t) => register(request, t)));
    g = (await createGroup(request, a, "Закрытая", false)).id;
    code = await inviteCode(request, a, g);
  });
  test.afterAll(async ({ request }) => cleanup(request, [a, b, e], [g]));

  test("новая группа закрыта: по коду не вступить и не узнать, что группа есть", async ({ request }) => {
    expect((await join(request, b, code)).status()).toBe(404);
    expect((await request.get(`${PB}/api/groups/preview`, { headers: h(b), params: { code } })).status()).toBe(404);
    expect((await list(request, b, "group_members")).length).toBe(0);
  });

  test("включать, выключать и сбрасывать может только владелец", async ({ request }) => {
    expect((await request.post(`${PB}/api/groups/${g}/invite/enable`, { headers: h(b), data: { enabled: true } })).status()).toBe(404);
    expect((await request.post(`${PB}/api/groups/${g}/invite/enable`, { headers: h(a), data: { enabled: true } })).ok()).toBeTruthy();
    expect((await join(request, b, code)).ok()).toBeTruthy();
    expect((await request.post(`${PB}/api/groups/${g}/invite/enable`, { headers: h(b), data: { enabled: false } })).status()).toBe(403);
    expect((await request.post(`${PB}/api/groups/${g}/invite/enable`, { headers: h(a), data: { enabled: false } })).ok()).toBeTruthy();
    expect((await join(request, e, code)).status()).toBe(404);
    expect((await list(request, b, "group_members", `group="${g}"`)).length).toBe(2); // участники остались
  });
});

test.describe("запросы доступа и копирование", () => {
  let a: Session; // автор
  let c: Session; // запрашивает
  let d: Session; // другой участник
  let e: Session; // посторонний
  let f: Session; // ещё один участник, без доступа
  let g = "";
  let gcode = "";
  let la = "";
  let hidden = ""; // лекция без включённого предпросмотра

  test.beforeAll(async ({ request }) => {
    [a, c, d, e, f] = await Promise.all(["a", "c", "d", "e", "f"].map((t) => register(request, t)));
    const grp = await groupWith(request, a, [c, d]);
    g = grp.id;
    gcode = grp.code;
    la = await createLecture(request, a, "Закрытая лекция", { group: g });
    await setPreview(request, a, g, true);
    hidden = await createLecture(request, d, "Скрытая лекция", { group: g });
  });
  test.afterAll(async ({ request }) => cleanup(request, [a, c, d, e, f], [g]));

  test("запросить можно только лекцию, название которой видно; повторный открытый запрос один", async ({ request }) => {
    expect((await request.post(`${PB}/api/lectures/${la}/request-access`, { headers: h(e) })).status(), "посторонний").toBe(404);
    expect((await request.post(`${PB}/api/lectures/${hidden}/request-access`, { headers: h(c) })).status(), "нет предпросмотра").toBe(404);
    expect((await request.post(`${PB}/api/lectures/${la}/request-access`, { headers: h(a) })).status(), "своя лекция").toBe(404);
    const r1 = await request.post(`${PB}/api/lectures/${la}/request-access`, { headers: h(c) });
    expect(r1.ok(), await r1.text()).toBeTruthy();
    const id1 = (await r1.json()).id;
    const r2 = await request.post(`${PB}/api/lectures/${la}/request-access`, { headers: h(c) });
    expect((await r2.json()).id, "пара (лекция, запрашивающий) уникальна, пока запрос открыт").toBe(id1);
    expect((await list(request, a, "access_requests")).length).toBe(1);
    // на уровне базы дубль открытого запроса невозможен
    const su = await superToken(request);
    if (su) {
      const dup = await request.post(`${PB}/api/collections/access_requests/records`, {
        headers: { Authorization: su },
        data: { lecture: la, requester: c.id, owner: a.id, group: g, status: "open" },
      });
      expect(dup.ok(), "второй открытый запрос в базе").toBeFalsy();
    }
    // запрос видят автор и запрашивающий, больше никто; напрямую запрос не создать и не изменить
    expect((await list(request, c, "access_requests")).length).toBe(1);
    expect((await list(request, d, "access_requests")).length).toBe(0);
    expect(await canGet(request, d, "access_requests", id1)).toBe(false);
    const forged = await request.post(`${PB}/api/collections/access_requests/records`, {
      headers: h(d),
      data: { lecture: la, requester: d.id, owner: a.id, group: g, status: "granted" },
    });
    expect(forged.ok(), "запрос в обход маршрута").toBeFalsy();
    const selfGrant = await request.patch(`${PB}/api/collections/access_requests/records/${id1}`, { headers: h(c), data: { status: "granted" } });
    expect(selfGrant.ok(), "запрашивающий сам себе разрешил").toBeFalsy();
    // решает только автор
    for (const s of [c, d, e]) {
      expect((await request.post(`${PB}/api/access-requests/${id1}/resolve`, { headers: h(s), data: { action: "grant" } })).status()).toBe(404);
    }
    expect(await canGet(request, c, "lectures", la)).toBe(false);
  });

  test("отклонить, запросить снова, разрешить с правом копирования", async ({ request }) => {
    const open = (await list(request, a, "access_requests", `status="open"`))[0];
    const dec = await request.post(`${PB}/api/access-requests/${open.id}/resolve`, { headers: h(a), data: { action: "decline" } });
    expect((await dec.json()).status).toBe("declined");
    expect((await request.post(`${PB}/api/access-requests/${open.id}/resolve`, { headers: h(a), data: { action: "grant" } })).status()).toBe(409);
    expect(await canGet(request, c, "lectures", la)).toBe(false);
    const again = await request.post(`${PB}/api/lectures/${la}/request-access`, { headers: h(c) });
    const id2 = (await again.json()).id;
    expect(id2).not.toBe(open.id);
    const ok = await request.post(`${PB}/api/access-requests/${id2}/resolve`, { headers: h(a), data: { action: "grant", allow_copy: false } });
    expect((await ok.json()).status).toBe("granted");
    expect(await canGet(request, c, "lectures", la)).toBe(true);
    expect((await request.post(`${PB}/api/lectures/${la}/request-access`, { headers: h(c) })).status()).toBe(409);
  });

  test("копировать можно, только если автор разрешил этому человеку; копия отдельная", async ({ request }) => {
    const mine = await createCourse(request, c, "Мой предмет");
    const noCopy = await request.post(`${PB}/api/lectures/${la}/copy`, { headers: h(c), data: { course: mine } });
    expect(noCopy.status()).toBe(403);
    for (const s of [d, e]) {
      expect((await request.post(`${PB}/api/lectures/${la}/copy`, { headers: h(s), data: {} })).status(), "без доступа").toBe(404);
    }
    // автор разрешает копирование именно этому человеку (на выданном доступе)
    const share = (await list(request, a, "lecture_shares", `lecture="${la}" && grantee="${c.id}"`))[0];
    const upd = await request.patch(`${PB}/api/collections/lecture_shares/records/${share.id}`, { headers: h(a), data: { allow_copy: true } });
    expect(upd.ok(), await upd.text()).toBeTruthy();
    // получатель сам себе разрешить не может
    const selfAllow = await request.patch(`${PB}/api/collections/lecture_shares/records/${share.id}`, { headers: h(c), data: { allow_copy: false } });
    expect(selfAllow.ok()).toBeFalsy();
    const foreign = await createCourse(request, d, "Чужой предмет");
    expect((await request.post(`${PB}/api/lectures/${la}/copy`, { headers: h(c), data: { course: foreign } })).status()).toBe(400);
    const ok = await request.post(`${PB}/api/lectures/${la}/copy`, { headers: h(c), data: { course: mine } });
    expect(ok.ok(), await ok.text()).toBeTruthy();
    const copyId = (await ok.json()).id;
    const copy = (await list(request, c, "lectures", `id="${copyId}"`))[0];
    expect(copy.owner).toBe(c.id);
    expect(copy.field).toBe(mine);
    expect(copy.content).toContain("секретный текст");
    expect(copyId).not.toBe(la);
    // авторская лекция не видна другим из-за копии; у третьего копирования нет
    expect(await canGet(request, d, "lectures", copyId)).toBe(false);
    // доступ другому человеку — копирование выключено по умолчанию (для каждого отдельно)
    const dShare = await grantShare(request, a, la, d, g);
    expect((await dShare.json()).allow_copy).toBe(false);
    expect((await request.post(`${PB}/api/lectures/${la}/copy`, { headers: h(d), data: {} })).status()).toBe(403);
  });

  test("данные для уведомлений: запрос, новый доступ, добавление в подгруппу — по времени «последний раз смотрел»", async ({ request }) => {
    const before = new Date(Date.now() - 60_000).toISOString();
    expect((await join(request, f, gcode)).ok()).toBeTruthy();
    const r = await request.post(`${PB}/api/lectures/${la}/request-access`, { headers: h(f) });
    expect(r.ok(), await r.text()).toBeTruthy();
    const n = await (await request.get(`${PB}/api/group/notifications`, { headers: h(a), params: { since: before } })).json();
    expect(n.has_new).toBe(true);
    expect(n.requests.some((x: any) => x.requester === f.id && x.lecture === la)).toBe(true);
    // получатель доступа видит «новый доступ»; запросов у него нет
    const mine = await (await request.get(`${PB}/api/group/notifications`, { headers: h(c), params: { since: before } })).json();
    expect(mine.shares.some((x: any) => x.lecture === la)).toBe(true);
    expect(mine.requests).toEqual([]);
    // после «прочитал» ничего нового
    const later = new Date(Date.now() + 60_000).toISOString();
    const none = await (await request.get(`${PB}/api/group/notifications`, { headers: h(a), params: { since: later } })).json();
    expect(none.has_new).toBe(false);
    // чужие запросы не попадают
    const other = await (await request.get(`${PB}/api/group/notifications`, { headers: h(e), params: { since: before } })).json();
    expect(other.has_new).toBe(false);
  });
});

test.describe("теги закрыты", () => {
  let a: Session;
  let b: Session;
  let tag = "";

  test.beforeAll(async ({ request }) => {
    [a, b] = await Promise.all(["a", "b"].map((t) => register(request, t)));
    const r = await request.post(`${PB}/api/collections/tags/records`, { headers: h(a), data: { name: "секретный-тег", owner: a.id } });
    expect(r.ok(), await r.text()).toBeTruthy();
    tag = (await r.json()).id;
  });
  test.afterAll(async ({ request }) => cleanup(request, [a, b]));

  test("без входа и чужому пользователю теги недоступны", async ({ request }) => {
    const anon = await request.get(`${PB}/api/collections/tags/records`);
    expect(((await anon.json()).items ?? []).length, "список без входа").toBe(0);
    expect((await request.get(`${PB}/api/collections/tags/records/${tag}`)).status(), "по id без входа").toBe(404);
    expect((await request.post(`${PB}/api/collections/tags/records`, { data: { name: "анонимный" } })).ok(), "создание без входа").toBeFalsy();
    expect((await request.delete(`${PB}/api/collections/tags/records/${tag}`)).ok(), "удаление без входа").toBeFalsy();
    expect(await list(request, b, "tags")).toEqual([]);
    expect(await canGet(request, b, "tags", tag)).toBe(false);
    expect((await request.patch(`${PB}/api/collections/tags/records/${tag}`, { headers: h(b), data: { name: "взлом" } })).ok()).toBeFalsy();
    expect((await request.delete(`${PB}/api/collections/tags/records/${tag}`, { headers: h(b) })).ok()).toBeFalsy();
    // создать тег «за другого» или присвоить чужой нельзя
    expect((await request.post(`${PB}/api/collections/tags/records`, { headers: h(b), data: { name: "подложный", owner: a.id } })).ok()).toBeFalsy();
    expect((await request.patch(`${PB}/api/collections/tags/records/${tag}`, { headers: h(a), data: { owner: b.id } })).ok()).toBeFalsy();
    // свой тег работает
    expect((await list(request, a, "tags")).map((t) => t.id)).toEqual([tag]);
    expect((await request.patch(`${PB}/api/collections/tags/records/${tag}`, { headers: h(a), data: { name: "новое-имя" } })).ok()).toBeTruthy();
  });
});
