/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exam_tickets — билет (вопрос + ответ + статус готовности).
//
//  `number` — первое в проекте настоящее поле порядка: везде
//  порядок держится на created/-updated, но номер билета это
//  ДАННЫЕ («вытянул тридцать седьмой»), он же адрес в URL и
//  он же переживает повторный импорт. Slug билету не нужен.
//
//  `status` хранится, а не выводится из пустоты ответа:
//  граница draft → ready — осознанное действие человека.
//
//  Правила — через связь: exam.owner. В Group Mode здесь
//  появится вторая ветка (членство + Proof of Knowledge),
//  форма схемы при этом не меняется.
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "exam.owner = @request.auth.id",
    "deleteRule": "exam.owner = @request.auth.id",
    "listRule": "exam.owner = @request.auth.id",
    "viewRule": "exam.owner = @request.auth.id",
    "updateRule": "exam.owner = @request.auth.id",
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
        "id": "relation1787400101",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "exam",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "number1787400102",
        "max": null,
        "min": null,
        "name": "number",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787400103",
        "max": 0,
        "min": 0,
        "name": "question",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "editor1787400104",
        "maxSize": 0,
        "name": "answer",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "hidden": false,
        "id": "file1787400105",
        "maxSelect": 0,
        "maxSize": 0,
        "mimeTypes": [],
        "name": "attachments",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "hidden": false,
        "id": "select1787400106",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["empty", "draft", "ready"]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_595999177",
        "hidden": false,
        "id": "relation1787400107",
        "maxSelect": 999,
        "minSelect": 0,
        "name": "sources",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787400108",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "author",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_1787400100",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_exam_tickets_exam_number` ON `exam_tickets` (`exam`, `number`)"
    ],
    "name": "exam_tickets",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787400100");

  return app.delete(collection);
})
