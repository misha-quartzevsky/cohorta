/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  schedule_slots — слот расписания (повторяющаяся пара).
//
//  subject     → courses (предмет в этом продукте — это курс)
//  semester    → semesters (текущий период; заполняется всегда)
//  weekday     1..6 (1 = понедельник)
//  pair_number 1..8
//  week_parity any | odd | even
//  kind        lecture | seminar | lab | other
//  room, teacher, date_from, date_to — необязательно
//
//  Уникальность клетки (weekday, pair_number, чётность) проверяется на
//  клиенте с понятной ошибкой (spec 2.2). Все данные — владельца.
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
        "id": "relation1790000101",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "owner",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3395098727",
        "hidden": false,
        "id": "relation1790000102",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "semester",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_955655590",
        "hidden": false,
        "id": "relation1790000103",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "subject",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "number1790000104",
        "max": 6,
        "min": 1,
        "name": "weekday",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number1790000105",
        "max": 8,
        "min": 1,
        "name": "pair_number",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "select1790000106",
        "maxSelect": 1,
        "name": "week_parity",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["any", "odd", "even"]
      },
      {
        "hidden": false,
        "id": "select1790000107",
        "maxSelect": 1,
        "name": "kind",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["lecture", "seminar", "lab", "other"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000108",
        "max": 120,
        "min": 0,
        "name": "room",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000109",
        "max": 160,
        "min": 0,
        "name": "teacher",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "date1790000110",
        "max": "",
        "min": "",
        "name": "date_from",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "date1790000111",
        "max": "",
        "min": "",
        "name": "date_to",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
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
    "id": "pbc_1790000100",
    "indexes": [
      "CREATE INDEX `idx_schedule_slots_owner` ON `schedule_slots` (`owner`)",
      "CREATE INDEX `idx_schedule_slots_cell` ON `schedule_slots` (`owner`, `weekday`, `pair_number`)"
    ],
    "name": "schedule_slots",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1790000100"));
})
