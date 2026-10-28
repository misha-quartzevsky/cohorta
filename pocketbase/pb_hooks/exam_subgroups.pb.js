/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exam_subgroups.pb.js — волна C: экзамены группы и подгруппы.
//  Билеты подгруппы (добавление, импорт, раздача, блокировка «Занят», «Взять мой ответ») — в exam_tickets.pb.js.
//
//  POST /api/exams/{id}/subgroups            {name, members[]}  создать подгруппу (я — её участник)
//  POST /api/subgroups/{id}/members          {user}             пригласить в подгруппу
//  POST /api/subgroups/{id}/leave                               выйти из подгруппы
//  GET  /api/groups/{id}/exams                                  экзамены группы (предмет, дата, моя подгруппа)
//  GET  /api/exams/{id}/group-info                              экзамен группы и кто уже в подгруппах (без названий)
//  GET  /api/exams/group-match?course=                          групповые экзамены с тем же названием предмета
//  POST /api/exams/{id}/join-group           {exam}             личный экзамен берёт список билетов группового
//
//  Подгруппу видят только участники: посторонний получает 404 и не узнаёт, что подгруппа есть.
//  Один человек — одна подгруппа на экзамен (проверка тут и уникальный индекс exam_participants(exam, user)).
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
