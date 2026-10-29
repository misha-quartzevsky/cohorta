/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Аудит безопасности 2026-10, волна 1: A-11.
//
//  deletion_requests.createRule был `@request.auth.id != "" && user = @request.auth.id`: клиент сам
//  задавал status, scheduled_for и email. Запись со сроком в прошлом заставляла ночную задачу
//  account_deletion стереть аккаунт без 14 дней отсрочки.
//  Теперь createRule = null: запись создаёт только маршрут POST /api/account/delete-request
//  (серверное сохранение в обход правил; срок +14 дней, email из аккаунта). Клиентская функция
//  requestDeletion() не вызывается нигде в apps/web/src.
//
//  DOWN возвращает прежнее правило.
// ============================================================

const WAS_CREATE = '@request.auth.id != "" && user = @request.auth.id';

migrate((app) => {
  const col = app.findCollectionByNameOrId("deletion_requests");
  col.createRule = null;
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("deletion_requests");
  col.createRule = WAS_CREATE;
  app.save(col);
});
