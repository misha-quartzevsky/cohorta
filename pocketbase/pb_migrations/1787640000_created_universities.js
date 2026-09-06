/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  universities — справочник вузов для онбординга.
//
//  Заполняется сид-миграцией (1787641000) и/или админкой.
//  Обычные пользователи только читают: поле `university` в
//  профиле ссылается сюда, а не найденный вуз уходит в
//  `users.university_custom` свободным текстом.
//
//  Уникальный индекс (name, city) — один вуз/кампус на город,
//  чтобы сид-скрипт мог делать upsert без дублей.
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787640001",
        "max": 255,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787640002",
        "max": 120,
        "min": 0,
        "name": "city",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787640003",
        "max": 120,
        "min": 0,
        "name": "region",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
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
      }
    ],
    "id": "pbc_1787640000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_universities_name_city` ON `universities` (`name`, `city`)"
    ],
    "name": "universities",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1787640000"));
})
