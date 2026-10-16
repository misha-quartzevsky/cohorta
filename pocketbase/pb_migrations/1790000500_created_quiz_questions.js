/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  quiz_questions — вопросы одной генерации (spec 2.5).
//
//  options/correct_index — только для type=mcq, answer — только для
//  type=recall (на клиенте, схема PB не умеет conditional required).
//  flagged — «плохой вопрос» (не показывать в будущих прохождениях),
//  hidden — скрыт пользователем вручную.
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
        "id": "relation1790000501",
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
        "collectionId": "pbc_1790000400",
        "hidden": false,
        "id": "relation1790000502",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "quiz",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_595999177",
        "hidden": false,
        "id": "relation1790000503",
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
        "id": "number1790000504",
        "max": null,
        "min": null,
        "name": "position",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "select1790000505",
        "maxSelect": 1,
        "name": "type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["mcq", "recall"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000506",
        "max": 60,
        "min": 0,
        "name": "topic",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000507",
        "max": 2000,
        "min": 0,
        "name": "prompt",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "json1790000508",
        "maxSize": 5000,
        "name": "options",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "number1790000509",
        "max": 3,
        "min": 0,
        "name": "correct_index",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000510",
        "max": 2000,
        "min": 0,
        "name": "answer",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000511",
        "max": 2000,
        "min": 0,
        "name": "explanation",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000512",
        "max": 400,
        "min": 0,
        "name": "quote",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "bool1790000513",
        "name": "flagged",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool1790000514",
        "name": "hidden",
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
    "id": "pbc_1790000500",
    "indexes": [
      "CREATE INDEX `idx_quiz_questions_lecture` ON `quiz_questions` (`lecture`)",
      "CREATE INDEX `idx_quiz_questions_quiz` ON `quiz_questions` (`quiz`)"
    ],
    "name": "quiz_questions",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1790000500"));
})
