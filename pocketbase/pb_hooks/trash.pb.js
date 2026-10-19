/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  trash.pb.js — корзина лекций и предметов (B6).
//
//  Мягкое удаление: у записи `deleted_at` = момент удаления. Правила
//  коллекций (миграция 1790006000) прячут такие записи от всех, поэтому
//  работаем через эти маршруты (они ходят в обход правил, но каждый раз
//  проверяют, что запись принадлежит вошедшему).
//
//  GET  /api/trash                      → что лежит в корзине
//  POST /api/trash/delete   {type, id}  → положить в корзину
//  POST /api/trash/restore  {type, id}  → вернуть
//  POST /api/trash/purge    {type, id}  → стереть насовсем
//  POST /api/trash/empty                → стереть всё своё
//
//  type: "lecture" | "course". Предмет уносит с собой свои лекции с
//  тем же временем удаления; при восстановлении предмета возвращаются
//  именно они, а лекции, удалённые раньше отдельно, остаются в корзине.
//  Раз в сутки задача стирает всё, что пролежало больше 30 дней.
//
//  Хелперы объявляем внутри обработчиков (JSVM изолирует scope).
// ============================================================

routerAdd(
  "GET",
  "/api/trash",
  (e) => {
    const uid = e.auth.id;
    const out = [];

    let courses = [];
    try {
      courses = e.app.findRecordsByFilter("courses", 'owner = {:u} && deleted_at != ""', "-deleted_at", 500, 0, { u: uid });
    } catch (err) {
      courses = [];
    }
    const trashedCourseAt = {};
    for (const c of courses) {
      const at = String(c.get("deleted_at"));
      trashedCourseAt[c.id] = at;
      let n = 0;
      try {
        n = e.app.countRecords("lectures", $dbx.exp("field = {:c} AND deleted_at = {:d}", { c: c.id, d: at }));
      } catch (err) {
        n = 0;
      }
      out.push({
        type: "course",
        id: c.id,
        title: String(c.get("name") || ""),
        cover_seed: c.get("cover_seed"),
        deleted_at: at,
        lectures: n,
      });
    }

    let lectures = [];
    try {
      lectures = e.app.findRecordsByFilter("lectures", 'owner = {:u} && deleted_at != ""', "-deleted_at", 1000, 0, { u: uid });
    } catch (err) {
      lectures = [];
    }
    for (const l of lectures) {
      const at = String(l.get("deleted_at"));
      const courseId = String(l.get("field") || "");
      // Лекция, ушедшая вместе с предметом, лежит внутри него — отдельной строки нет.
      if (courseId && trashedCourseAt[courseId] === at) continue;
      let courseName = "";
      let seed = null;
      if (courseId) {
        try {
          const c = e.app.findRecordById("courses", courseId);
          courseName = String(c.get("name") || "");
          seed = c.get("cover_seed");
        } catch (err) {
          courseName = "";
        }
      }
      out.push({
        type: "lecture",
        id: l.id,
        title: String(l.get("title") || ""),
        course_name: courseName,
        cover_seed: seed,
        deleted_at: at,
        lectures: 0,
      });
    }

    out.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1));
    return e.json(200, { items: out, days: 30 });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/trash/delete",
  (e) => {
    const data = new DynamicModel({ type: "", id: "" });
    e.bindBody(data);
    const uid = e.auth.id;
    const now = new Date().toISOString().replace("T", " ");

    if (data.type === "lecture") {
      let rec;
      try { rec = e.app.findRecordById("lectures", data.id); } catch (err) { throw new NotFoundError("Лекция не найдена."); }
      if (String(rec.get("owner")) !== uid) throw new ForbiddenError("Это не твоя лекция.");
      if (String(rec.get("deleted_at") || "") === "") {
        rec.set("deleted_at", now);
        e.app.save(rec);
      }
      return e.json(200, { ok: true, deleted_at: now });
    }
    if (data.type === "course") {
      let rec;
      try { rec = e.app.findRecordById("courses", data.id); } catch (err) { throw new NotFoundError("Предмет не найден."); }
      if (String(rec.get("owner")) !== uid) throw new ForbiddenError("Это не твой предмет.");
      if (String(rec.get("deleted_at") || "") === "") {
        const lectures = e.app.findRecordsByFilter("lectures", 'field = {:c} && deleted_at = ""', "", 5000, 0, { c: rec.id });
        for (const l of lectures) {
          l.set("deleted_at", now);
          e.app.save(l);
        }
        rec.set("deleted_at", now);
        e.app.save(rec);
      }
      return e.json(200, { ok: true, deleted_at: now });
    }
    throw new BadRequestError("Неизвестный тип.");
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/trash/restore",
  (e) => {
    const data = new DynamicModel({ type: "", id: "" });
    e.bindBody(data);
    const uid = e.auth.id;

    if (data.type === "lecture") {
      let rec;
      try { rec = e.app.findRecordById("lectures", data.id); } catch (err) { throw new NotFoundError("Лекция не найдена."); }
      if (String(rec.get("owner")) !== uid) throw new ForbiddenError("Это не твоя лекция.");
      // Предмет лекции тоже в корзине — возвращаем и его (только сам предмет).
      const courseId = String(rec.get("field") || "");
      if (courseId) {
        try {
          const c = e.app.findRecordById("courses", courseId);
          if (String(c.get("deleted_at") || "") !== "") {
            c.set("deleted_at", "");
            e.app.save(c);
          }
        } catch (err) {
          /* предмета уже нет — лекция вернётся без предмета */
        }
      }
      rec.set("deleted_at", "");
      e.app.save(rec);
      return e.json(200, { ok: true });
    }
    if (data.type === "course") {
      let rec;
      try { rec = e.app.findRecordById("courses", data.id); } catch (err) { throw new NotFoundError("Предмет не найден."); }
      if (String(rec.get("owner")) !== uid) throw new ForbiddenError("Это не твой предмет.");
      const at = String(rec.get("deleted_at") || "");
      if (at !== "") {
        const lectures = e.app.findRecordsByFilter("lectures", "field = {:c} && deleted_at = {:d}", "", 5000, 0, { c: rec.id, d: at });
        rec.set("deleted_at", "");
        e.app.save(rec);
        for (const l of lectures) {
          l.set("deleted_at", "");
          e.app.save(l);
        }
      }
      return e.json(200, { ok: true });
    }
    throw new BadRequestError("Неизвестный тип.");
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/trash/purge",
  (e) => {
    const data = new DynamicModel({ type: "", id: "" });
    e.bindBody(data);
    const uid = e.auth.id;

    if (data.type === "lecture") {
      let rec;
      try { rec = e.app.findRecordById("lectures", data.id); } catch (err) { throw new NotFoundError("Лекция не найдена."); }
      if (String(rec.get("owner")) !== uid) throw new ForbiddenError("Это не твоя лекция.");
      if (String(rec.get("deleted_at") || "") === "") throw new BadRequestError("Сначала положи в корзину.");
      e.app.delete(rec);
      return e.json(200, { ok: true });
    }
    if (data.type === "course") {
      let rec;
      try { rec = e.app.findRecordById("courses", data.id); } catch (err) { throw new NotFoundError("Предмет не найден."); }
      if (String(rec.get("owner")) !== uid) throw new ForbiddenError("Это не твой предмет.");
      if (String(rec.get("deleted_at") || "") === "") throw new BadRequestError("Сначала положи в корзину.");
      const lectures = e.app.findRecordsByFilter("lectures", "field = {:c}", "", 5000, 0, { c: rec.id });
      for (const l of lectures) e.app.delete(l);
      e.app.delete(rec);
      return e.json(200, { ok: true });
    }
    throw new BadRequestError("Неизвестный тип.");
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/trash/empty",
  (e) => {
    const uid = e.auth.id;
    const lectures = e.app.findRecordsByFilter("lectures", 'owner = {:u} && deleted_at != ""', "", 5000, 0, { u: uid });
    for (const l of lectures) e.app.delete(l);
    const courses = e.app.findRecordsByFilter("courses", 'owner = {:u} && deleted_at != ""', "", 1000, 0, { u: uid });
    for (const c of courses) {
      const rest = e.app.findRecordsByFilter("lectures", "field = {:c}", "", 5000, 0, { c: c.id });
      for (const l of rest) e.app.delete(l);
      e.app.delete(c);
    }
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

// Раз в сутки (03:00 по времени сервера): стереть всё, что пролежало больше 30 дней.
cronAdd("trash_purge", "0 3 * * *", () => {
  const cut = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().replace("T", " ");
  try {
    const old = $app.findRecordsByFilter("lectures", 'deleted_at != "" && deleted_at < {:c}', "", 5000, 0, { c: cut });
    for (const l of old) $app.delete(l);
    const oldCourses = $app.findRecordsByFilter("courses", 'deleted_at != "" && deleted_at < {:c}', "", 1000, 0, { c: cut });
    for (const c of oldCourses) {
      const rest = $app.findRecordsByFilter("lectures", "field = {:c}", "", 5000, 0, { c: c.id });
      for (const l of rest) $app.delete(l);
      $app.delete(c);
    }
  } catch (err) {
    console.log("[trash] purge failed:", err);
  }
});
