/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  groups — учебная группа/поток (режим «Группа»).
//
//  Self-service: любой авторизованный пользователь может создать
//  группу и становится её `owner`. `owner` управляет только самой
//  группой (переименование, перевыпуск invite_code, исключение
//  участника) — доступа к чужим лекциям это НЕ даёт.
//
//  Правила чтения намеренно широкие (`@request.auth.id != ""`):
//  экран «Группа» обязан находить УЖЕ существующие группы по
//  названию (fuzzy-поиск против фрагментации потока), то есть
//  читать и те группы, где пользователь ещё не состоит. Запись
//  групп содержит только name/slug/owner/invite_code — без лекций.
//
//  Изоляция лекций/карточек — отдельными коллекциями (P1 этап B+):
//  lecture_shares / lecture_previews. Здесь их нет.
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id",
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1787610001",
        "max": 120,
        "min": 1,
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
        "id": "text1787610002",
        "max": 60,
        "min": 1,
        "name": "slug",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787610003",
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
        "id": "text1787610004",
        "max": 32,
        "min": 1,
        "name": "invite_code",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_1787610000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_groups_slug` ON `groups` (`slug`)",
      "CREATE UNIQUE INDEX `idx_groups_invite_code` ON `groups` (`invite_code`)"
    ],
    "name": "groups",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787610000");
  return app.delete(collection);
})
