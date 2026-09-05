/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exam_participants — «пати» коллективного экзамена.
//
//  Организатор (exam.owner) вручную добавляет участников из
//  ростера своей группы — это НЕ вся группа, а именно та
//  подгруппа, что готовится вместе к этому экзамену.
//
//  Одна строка = «пользователь `user` участвует в экзамене
//  `exam`». Добавляет/убирает только организатор. Видит строку —
//  организатор и сам участник.
//
//  Доступ к чужим ОТВЕТАМ (`exam_tickets.answer`) — отдельно,
//  через Proof-of-Knowledge (хук `exam_pok.pb.js`): участие
//  даёт видеть вопросы, но не ответы, пока сам не внёс вклад.
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "exam.owner = @request.auth.id",
    "updateRule": null,
    "deleteRule": "exam.owner = @request.auth.id",
    "listRule": "exam.owner = @request.auth.id || user = @request.auth.id",
    "viewRule": "exam.owner = @request.auth.id || user = @request.auth.id",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_1787400000",
        "hidden": false,
        "id": "relation1787616001",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "exam",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787616002",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_1787616000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_exam_participants_exam_user` ON `exam_participants` (`exam`, `user`)"
    ],
    "name": "exam_participants",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1787616000"));
})
