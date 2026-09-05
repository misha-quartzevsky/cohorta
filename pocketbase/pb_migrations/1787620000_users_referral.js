/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  users — поля реферальной механики.
//
//  Атрибуция идёт через `invite_code` группы (единая ссылка,
//  не отдельный ?ref=user_id): кто пригласил = owner той группы,
//  по чьему коду человек вступил. Проставляет ХУК на group_members.
//
//  `invited_by`         — реферер (owner группы), ставит хук
//  `invited_group`  — через какую группу пришёл (аналитика)
//  `premium_until`      — простой гейт премиума, ведёт хук
//  `referral_rewarded`  — защита от повторного начисления
//
//  Все четыре пишет ТОЛЬКО серверный хук (referral.pb.js) через
//  app.save в обход API-правил. `premium_until` на users — быстрый
//  гейт; источник правды для аналитики — коллекция premium_grants.
//  Пользователь теоретически может подкрутить premium_until через
//  свой updateRule — на пилоте (премиум = будущая AI-фича) риск
//  косметический; при необходимости считать премиум по grants.
// ============================================================

function hasField(col, name) {
  for (const f of col.fields) if (f.name === name) return true;
  return false;
}

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  if (!hasField(users, "invited_by")) {
    users.fields.addAt(users.fields.length, new Field({
      "cascadeDelete": false,
      "collectionId": "_pb_users_auth_",
      "hidden": false,
      "id": "relation1787620001",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "invited_by",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }));
  }
  if (!hasField(users, "invited_group")) {
    users.fields.addAt(users.fields.length, new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_1787610000",
      "hidden": false,
      "id": "relation1787620002",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "invited_group",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }));
  }
  if (!hasField(users, "premium_until")) {
    users.fields.addAt(users.fields.length, new Field({
      "hidden": false,
      "id": "date1787620003",
      "max": "",
      "min": "",
      "name": "premium_until",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }));
  }
  if (!hasField(users, "referral_rewarded")) {
    users.fields.addAt(users.fields.length, new Field({
      "hidden": false,
      "id": "bool1787620004",
      "name": "referral_rewarded",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }));
  }

  app.save(users);
  console.log("users: referral fields added (invited_by, invited_group, premium_until, referral_rewarded)");
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  for (const id of [
    "relation1787620001",
    "relation1787620002",
    "date1787620003",
    "bool1787620004",
  ]) {
    try {
      users.fields.removeById(id);
    } catch (e) {
      /* skip */
    }
  }
  app.save(users);
})
