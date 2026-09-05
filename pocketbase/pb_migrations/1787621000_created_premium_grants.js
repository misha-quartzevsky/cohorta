/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  premium_grants — журнал начислений премиума (для аналитики).
//
//  Одна строка = «пользователю `user` начислено `days` дней
//  премиума по причине `source`». Награда двусторонняя: за
//  активацию приглашённого (первая написанная лекция) хук
//  referral.pb.js создаёт ДВЕ строки — приглашённому
//  (`referral_invitee`) и владельцу группы (`referral_inviter`).
//
//  `related_user`  — вторая сторона реферала
//  `related_group` — через какую группу
//
//  Пишет ТОЛЬКО хук. Читает — сам пользователь свои строки.
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
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
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787621001",
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
        "id": "number1787621002",
        "max": null,
        "min": 0,
        "name": "days",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "select1787621003",
        "maxSelect": 1,
        "name": "source",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["referral_inviter", "referral_invitee"]
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787621004",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "related_user",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1787610000",
        "hidden": false,
        "id": "relation1787621005",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "related_group",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate1787621006",
        "name": "granted_at",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_1787621000",
    "indexes": [],
    "name": "premium_grants",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1787621000"));
})
