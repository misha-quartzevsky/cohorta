/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lecture_previews — thumbnail чужой лекции для участников группы.
//
//  PocketBase API-rule работает на коллекцию целиком, поэтому
//  «видно превью, но не полный content» одним правилом на
//  `lectures` не выразить. Решение: отдельная коллекция с
//  коротким `preview_text` (заголовок + ~400 символов plain-text),
//  которую ведёт серверный хук `pb_hooks/lecture_previews.pb.js`
//  при сохранении/удалении лекции и при смене `preview_enabled`
//  участника.
//
//  Строка появляется, только если у лекции задана `group` И автор
//  включил `preview_enabled` для этой группы (персональное
//  разрешение, не следствие членства).
//
//  Пишет ТОЛЬКО хук (`e.app.save` в обход API-правил), поэтому
//  create/update/delete через API закрыты (`null`). Читают —
//  участники той же группы.
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "listRule": "@request.auth.id != \"\" && (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
    "viewRule": "@request.auth.id != \"\" && (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
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
        "collectionId": "pbc_595999177",
        "hidden": false,
        "id": "relation1787613001",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "lecture",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_1787610000",
        "hidden": false,
        "id": "relation1787613002",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "group",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787613003",
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
        "id": "text1787613004",
        "max": 300,
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787613005",
        "max": 600,
        "min": 0,
        "name": "preview_text",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_1787613000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_lecture_previews_lecture` ON `lecture_previews` (`lecture`)"
    ],
    "name": "lecture_previews",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1787613000"));
})
