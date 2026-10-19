/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  B6 — корзина: мягкое удаление лекций и предметов.
//
//  lectures.deleted_at, courses.deleted_at — когда положили в корзину
//  (пусто — не удалено). Хранится 30 дней, потом серверная задача
//  стирает насовсем (pb_hooks/trash.pb.js).
//
//  Правила чтения и правки теперь требуют `deleted_at = ""`: лекция из
//  корзины пропадает для всех сразу, в том числе для тех, кому открыт
//  доступ (lecture_shares не трогаем: при восстановлении доступ
//  возвращается сам). Корзину читает серверный маршрут /api/trash.
//  Квиз удалённой лекции гостю тоже не отдаётся.
// ============================================================

function hasField(col, name) {
  for (const f of col.fields) if (f.name === name) return true;
  return false;
}

function addDeletedAt(col, id) {
  if (hasField(col, "deleted_at")) return;
  col.fields.addAt(col.fields.length, new Field({
    "hidden": false, "id": id, "max": "", "min": "",
    "name": "deleted_at", "presentable": false, "required": false, "system": false, "type": "date"
  }));
}

const NOT_DELETED = 'deleted_at = ""';

migrate((app) => {
  const lectures = app.findCollectionByNameOrId("lectures");
  addDeletedAt(lectures, "date1790006001");
  lectures.listRule = `${NOT_DELETED} && (owner = "" || owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id))`;
  lectures.viewRule = lectures.listRule;
  lectures.updateRule = `${NOT_DELETED} && (owner = "" || owner = @request.auth.id)`;
  app.save(lectures);

  const courses = app.findCollectionByNameOrId("courses");
  addDeletedAt(courses, "date1790006002");
  courses.listRule = `${NOT_DELETED} && (owner = "" || owner = @request.auth.id)`;
  courses.viewRule = courses.listRule;
  courses.updateRule = courses.listRule;
  app.save(courses);

  const guest = "(@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id)";
  for (const name of ["quizzes", "quiz_questions"]) {
    const col = app.findCollectionByNameOrId(name);
    col.listRule = `lecture.deleted_at = "" && (lecture.owner = @request.auth.id || ${guest})`;
    col.viewRule = col.listRule;
    app.save(col);
  }
}, (app) => {
  const lectures = app.findCollectionByNameOrId("lectures");
  lectures.listRule = 'owner = "" || owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id)';
  lectures.viewRule = lectures.listRule;
  lectures.updateRule = 'owner = "" || owner = @request.auth.id';
  lectures.fields.removeByName("deleted_at");
  app.save(lectures);

  const courses = app.findCollectionByNameOrId("courses");
  courses.listRule = 'owner = "" || owner = @request.auth.id';
  courses.viewRule = courses.listRule;
  courses.updateRule = courses.listRule;
  courses.fields.removeByName("deleted_at");
  app.save(courses);

  const guest = "(@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id)";
  for (const name of ["quizzes", "quiz_questions"]) {
    const col = app.findCollectionByNameOrId(name);
    col.listRule = `lecture.owner = @request.auth.id || ${guest}`;
    col.viewRule = col.listRule;
    app.save(col);
  }
});
