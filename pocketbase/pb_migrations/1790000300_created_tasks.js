/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  tasks — задачи студента (spec 2.4)
//
//  title       text, ≤ 200, required
//  subject     → courses, необязательно
//  lecture     → lectures, необязательно, cascadeDelete:false
//  due         date (только дата, без времени)
//  done_at     date; пусто = открыта
//  source      manual | lecture | auto_review
//  dedupe_key  text (только auto_review): {kind}:{lectureId}:{YYYY-MM-DD}
//  dismissed   bool (только auto_review): пользователь скрыл подсказку
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
        "id": "relation1790000301",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "owner",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000302",
        "max": 200,
        "min": 1,
        "name": "title",
        "pattern": "",
        "presentable": true,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_955655590",
        "hidden": false,
        "id": "relation1790000303",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "subject",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_595999177",
        "hidden": false,
        "id": "relation1790000304",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "lecture",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "date1790000305",
        "max": "",
        "min": "",
        "name": "due",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "date1790000306",
        "max": "",
        "min": "",
        "name": "done_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "select1790000307",
        "maxSelect": 1,
        "name": "source",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["manual", "lecture", "auto_review"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1790000308",
        "max": 200,
        "min": 0,
        "name": "dedupe_key",
        "pattern": "",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "bool1790000309",
        "name": "dismissed",
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
    "id": "pbc_1790000300",
    "indexes": [
      "CREATE INDEX `idx_tasks_owner_done_due` ON `tasks` (`owner`, `done_at`, `due`)",
      "CREATE INDEX `idx_tasks_dedupe` ON `tasks` (`owner`, `dedupe_key`)"
    ],
    "name": "tasks",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1790000300"));
})
