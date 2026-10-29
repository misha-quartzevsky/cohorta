/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Аудит безопасности 2026-10, волна 1: A-1, B-3, B-4.
//
//  1. users.deleteRule: было `id = @request.auth.id`. Прямой DELETE пользователя обходил
//     14 дней и охрану «передай группу» и каскадом сносил группу и экзамены её участников.
//     Теперь null: аккаунт удаляется только маршрутом /api/account/delete-request и ночной
//     задачей account_deletion (они работают от имени сервера, правила для них не действуют).
//  2. exams.group: cascadeDelete true → false. Удаление группы больше не стирает чужие
//     экзамены: ссылка просто очищается, экзамен остаётся личным. Выход и исключение автора
//     отвязывают его экзамены в хуке lib_groups.js (detachExams).
//
//  DOWN возвращает прежнее: deleteRule `id = @request.auth.id`, exams.group cascadeDelete true.
// ============================================================

const WAS_DELETE = "id = @request.auth.id";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.deleteRule = null;
  app.save(users);

  const exams = app.findCollectionByNameOrId("exams");
  exams.fields.getByName("group").cascadeDelete = false;
  app.save(exams);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.deleteRule = WAS_DELETE;
  app.save(users);

  const exams = app.findCollectionByNameOrId("exams");
  exams.fields.getByName("group").cascadeDelete = true;
  app.save(exams);
});
