/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exams — экзамен как единица подготовки.
//
//  Singleton внутри курса: адрес экрана — /s/:sem/:course/exam,
//  поэтому slug не нужен, а второй экзамен на тот же курс
//  стал бы молча недостижимым. Отсюда UNIQUE (course, owner).
//
//  Первая коллекция проекта с owner-scoped правилами: всё
//  остальное открыто анониму (rules ""), и новый долг такого
//  рода мы не создаём — на этих правилах стоит будущий
//  Group Mode (Proof of Knowledge проверяется сервером).
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id",
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
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
        "cascadeDelete": false,
        "collectionId": "pbc_955655590",
        "hidden": false,
        "id": "relation1787400001",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "course",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787400002",
        "max": 0,
        "min": 0,
        "name": "title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "date1787400003",
        "max": "",
        "min": "",
        "name": "exam_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "cascadeDelete": true,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787400004",
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
        "id": "select1787400005",
        "maxSelect": 1,
        "name": "mode",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["solo", "group"]
      }
    ],
    "id": "pbc_1787400000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_exams_course_owner` ON `exams` (`course`, `owner`)"
    ],
    "name": "exams",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787400000");

  return app.delete(collection);
})
