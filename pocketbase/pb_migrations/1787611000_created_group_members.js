/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  group_members — членство «пользователь ↔ группа» (many-to-many).
//
//  Вступление — только за себя (`createRule: user = @request.auth.id`),
//  по invite_code группы (код проверяется на клиенте перед create;
//  на пилоте 60 человек серверная защита от подбора не нужна).
//
//  `preview_enabled` (default false) — ПЕРСОНАЛЬНОЕ разрешение
//  показывать свои конспекты участникам этой группы. Само членство
//  доступа к конспектам не даёт (P1 этап B).
//
//  Чтение ростера: свою строку видно всегда; владельцу группы —
//  весь ростер; участнику — других участников той же группы
//  (self-reference через @collection.group_members — проверено
//  curl-ом к живой базе перед фиксацией).
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "listRule": "user = @request.auth.id || group.owner = @request.auth.id || (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
    "viewRule": "user = @request.auth.id || group.owner = @request.auth.id || (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id || group.owner = @request.auth.id",
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
        "collectionId": "pbc_1787610000",
        "hidden": false,
        "id": "relation1787611001",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "group",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787611002",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate1787611003",
        "name": "joined_at",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "bool1787611004",
        "name": "preview_enabled",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      }
    ],
    "id": "pbc_1787611000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_group_members_group_user` ON `group_members` (`group`, `user`)"
    ],
    "name": "group_members",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787611000");
  return app.delete(collection);
})
