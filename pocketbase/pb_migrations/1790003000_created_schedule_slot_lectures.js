/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  schedule_slot_lectures — лекция, прикреплённая к паре постфактум
//  (B3, «Добавить конспект» в меню пустой пары), на одну конкретную
//  дату, а не на все повторения слота (решение владелицы 19 октября).
//
//  slot    → schedule_slots, какая пара
//  lecture → lectures, какая лекция
//  date    дата конкретного проведения пары (YYYY-MM-DD)
//
//  Одна и та же лекция может быть прикреплена к разным парам и датам
//  (например, Философия вторник 4 пара и Философия четверг 2 пара) —
//  поэтому это отдельная таблица-связка, а не поле на лекции (у лекции
//  уже есть свои slot/lecture_date — это её «родная» пара, см.
//  1790000200_lectures_schedule_fields.js, не трогаем).
//
//  Уникальность (slot, date): на одну дату у пары одна лекция.
// ============================================================

const LECTURES_ID = "pbc_595999177";
const SCHEDULE_SLOTS_ID = "pbc_1790000100";

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
        "id": "relation1790003001",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "owner",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": SCHEDULE_SLOTS_ID,
        "hidden": false,
        "id": "relation1790003002",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "slot",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": LECTURES_ID,
        "hidden": false,
        "id": "relation1790003003",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "lecture",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "date1790003004",
        "max": "",
        "min": "",
        "name": "date",
        "presentable": false,
        "required": true,
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
    "id": "pbc_1790003000",
    "indexes": [
      "CREATE INDEX `idx_slot_lectures_owner` ON `schedule_slot_lectures` (`owner`)",
      "CREATE UNIQUE INDEX `idx_slot_lectures_cell` ON `schedule_slot_lectures` (`slot`, `date`)",
      "CREATE INDEX `idx_slot_lectures_lecture` ON `schedule_slot_lectures` (`lecture`)"
    ],
    "name": "schedule_slot_lectures",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1790003000"));
})
