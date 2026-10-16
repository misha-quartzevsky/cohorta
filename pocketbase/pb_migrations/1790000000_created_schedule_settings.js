/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  schedule_settings — настройки расписания (одна строка на юзера).
//
//  pair_times      — массив { n, start:"HH:MM", end:"HH:MM" } (json)
//  odd_week_anchor — понедельник нечётной недели (date), якорь чётности
//  show_saturday   — показывать субботу (bool, клиент ставит true)
//
//  Если строки нет, клиент создаёт её со значениями по умолчанию при
//  первом заходе на экран расписания (spec 2.1). Все данные — владельца.
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id",
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
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
        "cascadeDelete": true,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1790000001",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "owner",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "json1790000002",
        "maxSize": 20000,
        "name": "pair_times",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "date1790000003",
        "max": "",
        "min": "",
        "name": "odd_week_anchor",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "bool1790000004",
        "name": "show_saturday",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
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
      }
    ],
    "id": "pbc_1790000000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_schedule_settings_owner` ON `schedule_settings` (`owner`)"
    ],
    "name": "schedule_settings",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1790000000"));
})
