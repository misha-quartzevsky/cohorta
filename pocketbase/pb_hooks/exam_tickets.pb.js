/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exam_tickets.pb.js — волна C: билеты подгруппы.
//  Экзамены группы, подгруппы и их состав — в exam_subgroups.pb.js.
//
//  POST /api/subgroups/{id}/tickets          {question}         добавить билет
//  POST /api/subgroups/{id}/tickets/bulk     {questions[]}      импорт списка билетов (не больше 500 за раз)
//  POST /api/subgroups/{id}/distribute                          раздать свободные билеты поровну
//  POST /api/tickets/{id}/assign             {users[]}          назначить билет (интерфейс пока не вызывает, заготовка)
//  POST /api/tickets/{id}/lock | /unlock                         блокировка «Занят» (LOCK_SECONDS, 30 секунд)
//  POST /api/tickets/{id}/take-my-answer     {source}           «Взять мой ответ»
//
//  Билет подгруппы видят только участники подгруппы (постороннему 404).
//  Блокировку билета проверяет сервер (хук onRecordUpdateRequest ниже), а не только интерфейс.
// ============================================================

routerAdd(
  "POST",
  "/api/subgroups/{id}/tickets",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const sub = g.memberSubgroup(e);
    const data = new DynamicModel({ question: "", answer: "" });
    e.bindBody(data);
    const question = String(data.question || "").trim();
    if (!question) throw new BadRequestError("Введите вопрос билета.");
    const answer = String(data.answer || "").trim();
    const rec = new Record(e.app.findCollectionByNameOrId("exam_tickets"));
    const number = g.nextTicketNumber(e.app, sub);
    rec.set("exam", sub.get("exam"));
    rec.set("number", number);
    rec.set("question", question);
    rec.set("subgroup", sub.id);
    rec.set("answer", answer);
    rec.set("status", answer ? "draft" : "empty");
    e.app.save(rec);
    return e.json(200, { id: rec.id, number });
  },
  $apis.requireAuth()
);

// Импорт списка билетов в подгруппу: одна строка списка = один билет, номера идут после существующих
// билетов подгруппы, в порядке списка. Может любой участник подгруппы (как «Добавить билет»);
// постороннему и участнику чужой подгруппы подгруппа не раскрывается (404).
routerAdd(
  "POST",
  "/api/subgroups/{id}/tickets/bulk",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const sub = g.memberSubgroup(e);
    const data = new DynamicModel({ questions: [] });
    e.bindBody(data);
    const list = [];
    for (const q of data.questions || []) {
      const text = String(q || "").trim();
      if (text) list.push(text);
    }
    if (list.length === 0) throw new BadRequestError("В списке нет ни одного билета.");
    if (list.length > 500) throw new BadRequestError("Слишком длинный список: не больше 500 билетов за раз.");
    let first = 0;
    e.app.runInTransaction((tx) => {
      const col = tx.findCollectionByNameOrId("exam_tickets");
      let n = g.nextTicketNumber(tx, sub);
      first = n;
      for (const question of list) {
        const rec = new Record(col);
        rec.set("exam", sub.get("exam"));
        rec.set("number", n);
        rec.set("question", question);
        rec.set("subgroup", sub.id);
        rec.set("status", "empty");
        tx.save(rec);
        n += 1;
      }
    });
    return e.json(200, { added: list.length, first });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/subgroups/{id}/distribute",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const sub = g.memberSubgroup(e);
    const members = g.all(e.app, "exam_participants", "subgroup = {:s}", { s: sub.id }).map((p) => String(p.get("user")));
    const tickets = g.all(e.app, "exam_tickets", "subgroup = {:s}", { s: sub.id });
    const load = {};
    for (const m of members) load[m] = 0;
    for (const t of tickets) for (const a of t.get("assignees") || []) if (load[a] !== undefined) load[a] += 1;
    let n = 0;
    for (const t of tickets) {
      if ((t.get("assignees") || []).length > 0) continue;
      let best = members[0];
      for (const m of members) if (load[m] < load[best]) best = m;
      t.set("assignees", [best]);
      e.app.save(t);
      load[best] += 1;
      n += 1;
    }
    return e.json(200, { assigned: n });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/tickets/{id}/assign",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const t = g.memberTicket(e);
    const data = new DynamicModel({ users: [] });
    e.bindBody(data);
    const users = [];
    for (const u of data.users || []) {
      const uid = String(u);
      if (!g.isSubgroupMember(e.app, String(t.get("subgroup")), uid)) {
        throw new BadRequestError("Назначить можно только участника подгруппы.");
      }
      users.push(uid);
    }
    t.set("assignees", users);
    e.app.save(t);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/tickets/{id}/lock",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const t = g.memberTicket(e);
    const holder = String(t.get("locked_by") || "");
    const until = String(t.get("locked_until") || "");
    if (g.isLockedByOther(t, e.auth.id)) {
      return e.json(409, { code: "busy", locked_by: holder, locked_until: until });
    }
    const next = g.inSeconds(g.LOCK_SECONDS);
    t.set("locked_by", e.auth.id);
    t.set("locked_until", next);
    e.app.save(t);
    return e.json(200, { locked_until: next });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/tickets/{id}/unlock",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const t = g.memberTicket(e);
    if (String(t.get("locked_by") || "") === e.auth.id) {
      t.set("locked_by", "");
      t.set("locked_until", "");
      e.app.save(t);
    }
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

// «Взять мой ответ»: личный ответ из моего экзамена заменяет текст билета подгруппы.
routerAdd(
  "POST",
  "/api/tickets/{id}/take-my-answer",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const t = g.memberTicket(e);
    const holder = String(t.get("locked_by") || "");
    if (g.isLockedByOther(t, e.auth.id)) {
      return e.json(409, { code: "busy", locked_by: holder });
    }
    const data = new DynamicModel({ source: "" });
    e.bindBody(data);
    let src;
    try {
      src = e.app.findRecordById("exam_tickets", String(data.source));
    } catch (err) {
      throw new BadRequestError("Свой билет не найден.");
    }
    const srcExam = e.app.findRecordById("exams", String(src.get("exam")));
    if (srcExam.get("owner") !== e.auth.id || String(src.get("subgroup") || "") !== "") {
      throw new BadRequestError("Свой билет не найден.");
    }
    const answer = String(src.get("answer") || "");
    t.set("answer", answer);
    t.set("status", answer ? "draft" : "empty");
    t.set("locked_by", e.auth.id);
    t.set("locked_until", g.inSeconds(g.LOCK_SECONDS));
    e.app.save(t);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

// Запись билета подгруппы: только участник, и только если блокировку не держит другой.
// Блокировку занимает сам запрос (30 секунд бездействия снимают её).
onRecordUpdateRequest((e) => {
  const sid = String(e.record.get("subgroup") || "");
  if (sid && e.auth && !e.hasSuperuserAuth()) {
    const g = require(`${__hooks}/lib_groups.js`);
    const me = e.auth.id;
    if (!g.isSubgroupMember(e.app, sid, me)) {
      throw new NotFoundError("Не найдено.");
    }
    if (g.isLockedByOther(e.record, me)) {
      throw new ApiError(409, "Билет занят: его сейчас правит другой участник.", { code: "busy" });
    }
    e.record.set("locked_by", me);
    e.record.set("locked_until", g.inSeconds(g.LOCK_SECONDS));
  }
  e.next();
}, "exam_tickets");
