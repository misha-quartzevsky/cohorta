/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exam_groups.pb.js — волна C: экзамены группы, подгруппы, билеты подгруппы.
//
//  POST /api/exams/{id}/subgroups            {name, members[]}  создать подгруппу (я — её участник)
//  POST /api/subgroups/{id}/members          {user}             пригласить в подгруппу
//  POST /api/subgroups/{id}/leave                               выйти из подгруппы
//  POST /api/subgroups/{id}/tickets          {question}         добавить билет
//  POST /api/subgroups/{id}/distribute                          раздать свободные билеты поровну
//  POST /api/tickets/{id}/assign             {users[]}          назначить билет
//  POST /api/tickets/{id}/lock | /unlock                         блокировка «Занят» (30 секунд)
//  POST /api/tickets/{id}/take-my-answer     {source}           «Взять мой ответ»
//  GET  /api/groups/{id}/exams                                  экзамены группы (предмет, дата, моя подгруппа)
//  GET  /api/exams/{id}/group-info                              экзамен группы и кто уже в подгруппах (без названий)
//  GET  /api/exams/group-match?course=                          групповые экзамены с тем же названием предмета
//  POST /api/exams/{id}/join-group           {exam}             личный экзамен берёт список билетов группового
//
//  Подгруппу и её билеты видят только участники: посторонний получает 404 и
//  не узнаёт, что подгруппа есть. Один человек — одна подгруппа на экзамен
//  (проверка тут и уникальный индекс exam_participants(exam, user)).
//  Блокировку билета проверяет сервер (хук ниже), а не только интерфейс.
// ============================================================

routerAdd(
  "POST",
  "/api/exams/{id}/subgroups",
  (e) => {
    const db = require(`${__hooks}/lib_db.js`);
    const g = require(`${__hooks}/lib_groups.js`);
    const me = e.auth.id;
    const exam = db.getOr404(e.app, "exams", e.request.pathValue("id"), "Экзамен не найден.");
    const groupId = String(exam.get("group") || "");
    if (!groupId || !g.isMember(e.app, groupId, me)) throw new NotFoundError("Экзамен не найден.");
    const data = new DynamicModel({ name: "", members: [] });
    e.bindBody(data);
    const name = String(data.name || "").trim();
    if (!name) throw new BadRequestError("Введите название подгруппы.");
    const ids = [me];
    for (const u of data.members || []) if (ids.indexOf(String(u)) < 0) ids.push(String(u));
    for (const uid of ids) {
      if (!g.isMember(e.app, groupId, uid)) throw new BadRequestError("Этот человек не состоит в группе.");
      const part = g.first(e.app, "exam_participants", "exam = {:x} && user = {:u}", { x: exam.id, u: uid });
      if (part && String(part.get("subgroup") || "") !== "") {
        return e.json(409, { code: "already_in_subgroup", user: uid });
      }
    }
    let subId = "";
    e.app.runInTransaction((tx) => {
      const sub = new Record(tx.findCollectionByNameOrId("exam_subgroups"));
      sub.set("exam", exam.id);
      sub.set("name", name);
      sub.set("created_by", me);
      tx.save(sub);
      subId = sub.id;
      const pcol = tx.findCollectionByNameOrId("exam_participants");
      for (const uid of ids) {
        let part = g.first(tx, "exam_participants", "exam = {:x} && user = {:u}", { x: exam.id, u: uid });
        if (!part) {
          part = new Record(pcol);
          part.set("exam", exam.id);
          part.set("user", uid);
        }
        part.set("subgroup", sub.id);
        tx.save(part);
      }
      // общий список билетов копируется в подгруппу (ответы у подгруппы свои)
      const tcol = tx.findCollectionByNameOrId("exam_tickets");
      for (const t of g.all(tx, "exam_tickets", "exam = {:x} && subgroup = ''", { x: exam.id })) {
        const c = new Record(tcol);
        c.set("exam", exam.id);
        c.set("number", t.get("number"));
        c.set("question", t.get("question"));
        c.set("subgroup", sub.id);
        c.set("status", "empty");
        tx.save(c);
      }
    });
    return e.json(200, { id: subId });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/subgroups/{id}/members",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const sub = g.memberSubgroup(e);
    const data = new DynamicModel({ user: "" });
    e.bindBody(data);
    const uid = String(data.user || "");
    const exam = e.app.findRecordById("exams", String(sub.get("exam")));
    const groupId = String(exam.get("group") || "");
    if (!uid || !g.isMember(e.app, groupId, uid)) throw new BadRequestError("Этот человек не состоит в группе.");
    let part = g.first(e.app, "exam_participants", "exam = {:x} && user = {:u}", { x: exam.id, u: uid });
    if (part && String(part.get("subgroup") || "") !== "") {
      return e.json(409, { code: "already_in_subgroup", user: uid });
    }
    e.app.runInTransaction((tx) => {
      if (!part) {
        part = new Record(tx.findCollectionByNameOrId("exam_participants"));
        part.set("exam", exam.id);
        part.set("user", uid);
      }
      part.set("subgroup", sub.id);
      tx.save(part);
      g.grantSubgroupShares(tx, sub, uid);
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/subgroups/{id}/leave",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const sub = g.memberSubgroup(e);
    e.app.runInTransaction((tx) => g.removeFromSubgroup(tx, sub, e.auth.id));
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

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
    const db = require(`${__hooks}/lib_db.js`);
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
    const db = require(`${__hooks}/lib_db.js`);
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
    const db = require(`${__hooks}/lib_db.js`);
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
    const db = require(`${__hooks}/lib_db.js`);
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

routerAdd(
  "GET",
  "/api/exams/group-match",
  (e) => {
    const db = require(`${__hooks}/lib_db.js`);
    const g = require(`${__hooks}/lib_groups.js`);
    const me = e.auth.id;
    const course = db.getOr404(e.app, "courses", String(e.request.url.query().get("course") || ""), "Предмет не найден.");
    if (course.get("owner") !== me) throw new NotFoundError("Предмет не найден.");
    const want = g.norm(course.get("name"));
    const out = [];
    for (const m of g.all(e.app, "group_members", "user = {:u}", { u: me })) {
      const gid = String(m.get("group"));
      for (const ex of g.all(e.app, "exams", "group = {:g} && owner != {:u}", { g: gid, u: me })) {
        let name = "";
        try {
          name = String(e.app.findRecordById("courses", String(ex.get("course"))).get("name") || "");
        } catch (err) {
          name = "";
        }
        if (g.norm(name) === want) {
          out.push({ exam: ex.id, group: gid, title: name });
        }
      }
    }
    return e.json(200, out);
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/exams/{id}/join-group",
  (e) => {
    const db = require(`${__hooks}/lib_db.js`);
    const g = require(`${__hooks}/lib_groups.js`);
    const me = e.auth.id;
    const mine = db.getOr404(e.app, "exams", e.request.pathValue("id"), "Экзамен не найден.");
    if (mine.get("owner") !== me) throw new NotFoundError("Экзамен не найден.");
    const data = new DynamicModel({ exam: "" });
    e.bindBody(data);
    const target = db.getOr404(e.app, "exams", String(data.exam), "Экзамен не найден.");
    const gid = String(target.get("group") || "");
    if (!gid || !g.isMember(e.app, gid, me)) throw new NotFoundError("Экзамен не найден.");
    const nameOf = (ex) => {
      try {
        return g.norm(e.app.findRecordById("courses", String(ex.get("course"))).get("name"));
      } catch (err) {
        return "";
      }
    };
    if (nameOf(mine) !== nameOf(target)) throw new BadRequestError("Названия предметов не совпадают.");
    const have = {};
    for (const t of g.all(e.app, "exam_tickets", "exam = {:x} && subgroup = ''", { x: mine.id })) have[String(t.get("number"))] = true;
    const col = e.app.findCollectionByNameOrId("exam_tickets");
    let n = 0;
    for (const t of g.all(e.app, "exam_tickets", "exam = {:x} && subgroup = ''", { x: target.id })) {
      if (have[String(t.get("number"))]) continue;
      const c = new Record(col);
      c.set("exam", mine.id);
      c.set("number", t.get("number"));
      c.set("question", t.get("question"));
      c.set("status", "empty");
      e.app.save(c);
      n += 1;
    }
    return e.json(200, { added: n });
  },
  $apis.requireAuth()
);

// Экзамены группы для участника: название и обложка предмета берутся у автора (см. examView в lib_groups.js).
routerAdd(
  "GET",
  "/api/groups/{id}/exams",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const gid = e.request.pathValue("id");
    if (!g.isMember(e.app, gid, e.auth.id)) throw new NotFoundError("Группа не найдена.");
    const out = [];
    for (const ex of g.all(e.app, "exams", "group = {:g}", { g: gid })) out.push(g.examView(e.app, ex, e.auth.id));
    return e.json(200, out);
  },
  $apis.requireAuth()
);

// Один экзамен группы + кто из участников группы уже в подгруппе этого экзамена
// (без имени подгруппы: чужая подгруппа остаётся скрытой).
routerAdd(
  "GET",
  "/api/exams/{id}/group-info",
  (e) => {
    const db = require(`${__hooks}/lib_db.js`);
    const g = require(`${__hooks}/lib_groups.js`);
    const exam = db.getOr404(e.app, "exams", e.request.pathValue("id"), "Экзамен не найден.");
    const gid = String(exam.get("group") || "");
    if (!gid || !g.isMember(e.app, gid, e.auth.id)) throw new NotFoundError("Экзамен не найден.");
    const taken = [];
    for (const p of g.all(e.app, "exam_participants", "exam = {:x} && subgroup != ''", { x: exam.id })) taken.push(String(p.get("user")));
    return e.json(200, { exam: g.examView(e.app, exam, e.auth.id), taken });
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
