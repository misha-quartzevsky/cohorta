/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lecture_shares — точечная выдача полного доступа к лекции.
//
//  Одна строка = «автор `owner` дал полный доступ к лекции
//  `lecture` пользователю `grantee`». Отзыв — удаление строки,
//  мгновенно и индивидуально (остальные грантополучатели не
//  затронуты). Паттерн шеринга Google Docs, не общий тумблер.
//
//  `owner` дублируется из лекции — чтобы правило доступа не
//  ходило по связи `lecture.owner` (дешевле и надёжнее).
//
//  Выдаёт/отзывает только автор. Видит строку — автор и сам
//  грантополучатель. UI выдачи («Доступ») — этап C; здесь
//  коллекция нужна, чтобы на неё могло ссылаться правило
//  `lectures` (миграция 1787615000).
// ============================================================

migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id",
    "listRule": "owner = @request.auth.id || grantee = @request.auth.id",
    "viewRule": "owner = @request.auth.id || grantee = @request.auth.id",
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
        "id": "relation1787614001",
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
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787614002",
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
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1787614003",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "grantee",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_1787614000",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_lecture_shares_lecture_grantee` ON `lecture_shares` (`lecture`, `grantee`)"
    ],
    "name": "lecture_shares",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("pbc_1787614000"));
})
