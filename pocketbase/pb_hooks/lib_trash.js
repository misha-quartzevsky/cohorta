/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lib_trash.js — общие операции корзины для trash.pb.js.
//
//  Подключается require(`${__hooks}/lib_trash.js`) внутри обработчика.
//  Предмет уносит с собой свои лекции с тем же временем удаления;
//  при восстановлении предмета возвращаются именно они. Стирание
//  предмета стирает все его лекции (и ту, что лежала в корзине отдельно).
// ============================================================

const { getOr404 } = require("./lib_db.js");

const KINDS = {
  lecture: { collection: "lectures", missing: "Лекция не найдена.", notYours: "Это не твоя лекция." },
  course: { collection: "courses", missing: "Предмет не найден.", notYours: "Это не твой предмет." },
};

/** Запись корзины по типу и id, только своя: неизвестный тип — 400, нет записи — 404, чужая — 403. */
function ownedRecord(app, userId, type, id) {
  const kind = Object.prototype.hasOwnProperty.call(KINDS, type) ? KINDS[type] : null;
  if (!kind) throw new BadRequestError("Неизвестный тип.");
  const rec = getOr404(app, kind.collection, id, kind.missing);
  if (String(rec.get("owner")) !== userId) throw new ForbiddenError(kind.notYours);
  return rec;
}

const inTrash = (rec) => String(rec.get("deleted_at") || "") !== "";

/** Положить в корзину (повторно не перезаписывает время). Предмет уносит свои живые лекции. */
function trash(app, type, rec, at) {
  if (inTrash(rec)) return;
  if (type === "course") {
    const lectures = app.findRecordsByFilter("lectures", 'field = {:c} && deleted_at = ""', "", 5000, 0, { c: rec.id });
    for (const l of lectures) {
      l.set("deleted_at", at);
      app.save(l);
    }
  }
  rec.set("deleted_at", at);
  app.save(rec);
}

/** Вернуть из корзины. Лекция возвращает и свой предмет (только его), предмет — лекции с тем же временем удаления. */
function restore(app, type, rec) {
  if (type === "lecture") {
    // Предмет лекции тоже в корзине — возвращаем и его (только сам предмет).
    const courseId = String(rec.get("field") || "");
    if (courseId) {
      try {
        const c = app.findRecordById("courses", courseId);
        if (inTrash(c)) {
          c.set("deleted_at", "");
          app.save(c);
        }
      } catch (err) {
        /* предмета уже нет — лекция вернётся без предмета */
      }
    }
    rec.set("deleted_at", "");
    app.save(rec);
    return;
  }
  const at = String(rec.get("deleted_at") || "");
  if (at === "") return;
  const lectures = app.findRecordsByFilter("lectures", "field = {:c} && deleted_at = {:d}", "", 5000, 0, { c: rec.id, d: at });
  rec.set("deleted_at", "");
  app.save(rec);
  for (const l of lectures) {
    l.set("deleted_at", "");
    app.save(l);
  }
}

/** Стереть предмет насовсем вместе со всеми его лекциями. */
function purgeCourse(app, course) {
  const lectures = app.findRecordsByFilter("lectures", "field = {:c}", "", 5000, 0, { c: course.id });
  for (const l of lectures) app.delete(l);
  app.delete(course);
}

/** Стереть насовсем запись, которая уже лежит в корзине (иначе 400). */
function purge(app, type, rec) {
  if (!inTrash(rec)) throw new BadRequestError("Сначала положи в корзину.");
  if (type === "course") purgeCourse(app, rec);
  else app.delete(rec);
}

module.exports = { ownedRecord, trash, restore, purge, purgeCourse };
