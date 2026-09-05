/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  deletion_requests — запрос на удаление аккаунта/данных.
//
//  Минимальная гигиена: путь «удалить меня» должен существовать
//  и быть доступен из профиля. Полной автоматизации нет — на
//  пилоте (60 человек) запросы обрабатываются вручную через
//  админку PocketBase (status: new → done).
//
//  `email` — снимок на момент запроса (юзера могут удалить
//  раньше, чем дойдут руки). Создать строку может только сам
//  пользователь за себя; читает свои; правит/удаляет — никто
//  через API (только суперюзер в админке).
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "updateRule": null,
    "deleteRule": null,
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
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
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787630001",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787630002",
        "max": 255,
        "min": 0,
        "name": "email",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787630003",
        "max": 2000,
        "min": 0,
        "name": "reason",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select1787630004",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["new", "done"]
      }
    ],
    "id": "pbc_1787630000",
    "indexes": [],
    "name": "deletion_requests",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1787630000"));
})
