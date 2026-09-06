/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  semesters → «периоды обучения» (per-user).
//
//  Коллекция остаётся костяком навигации (роуты /s/:slug, связь
//  courses.semesters, SemesterProvider), но перестаёт быть общим
//  справочником: теперь у каждой записи есть владелец `user`, а
//  студент сам заводит свой набор в онбординге.
//
//  Новые поля:
//    user       — владелец (relation → users), проставляет онбординг
//    group      — задел на групповые периоды, сейчас всегда пусто
//    label      — «1 семестр», «Осенний триместр», …  (в UI)
//    order      — порядковый номер (сортировка); slug = String(order)
//    type       — semester | trimester | quarter | module | custom
//    is_current — текущий период (максимум один, не форсируем в БД)
//
//  Backfill: 12 легаси-строк (slug "1".."12") привязываем к
//  демо-юзеру (77234u87ry5608m), чтобы демо-аккаунт остался рабочим.
//  Правила: было открыто ("") → строго per-user.
// ============================================================

const SEM_ID = "pbc_3395098727";
const DEMO_USER_ID = "77234u87ry5608m";

function hasField(col, name) {
  for (const f of col.fields) if (f.name === name) return true;
  return false;
}

migrate((app) => {
  const collection = app.findCollectionByNameOrId(SEM_ID);

  if (!hasField(collection, "user")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "cascadeDelete": false,
      "collectionId": "_pb_users_auth_",
      "hidden": false,
      "id": "relation1787642001",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "user",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }));
  }
  if (!hasField(collection, "group")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_1787610000",
      "hidden": false,
      "id": "relation1787642002",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "group",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }));
  }
  if (!hasField(collection, "label")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1787642003",
      "max": 120,
      "min": 0,
      "name": "label",
      "pattern": "",
      "presentable": true,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }));
  }
  if (!hasField(collection, "order")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "hidden": false,
      "id": "number1787642004",
      "max": null,
      "min": null,
      "name": "order",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }));
  }
  if (!hasField(collection, "type")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "hidden": false,
      "id": "select1787642005",
      "maxSelect": 1,
      "name": "type",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": ["semester", "trimester", "quarter", "module", "custom"]
    }));
  }
  if (!hasField(collection, "is_current")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "hidden": false,
      "id": "bool1787642006",
      "name": "is_current",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }));
  }

  app.save(collection);

  // --- Backfill: легаси-семестры → демо-юзер ---
  const demo = app.findRecordsByFilter("users", `id = "${DEMO_USER_ID}"`, "", 1, 0);
  if (demo.length > 0) {
    const rows = app.findRecordsByFilter("semesters", "slug != \"\"", "order,slug", 1000, 0);
    for (const row of rows) {
      if (row.get("user")) continue; // уже привязан — не трогаем
      const slug = String(row.get("slug"));
      const n = parseInt(slug, 10);
      row.set("user", DEMO_USER_ID);
      row.set("order", Number.isNaN(n) ? 0 : n);
      row.set("label", `${slug} семестр`);
      row.set("type", "semester");
      app.save(row);
    }
    console.log(`Backfilled ${rows.length} legacy semesters → demo user`);
  } else {
    console.log("Demo user not found — skipped legacy semester backfill");
  }

  // --- Правила: строго per-user ---
  unmarshal({
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id"
  }, collection);
  app.save(collection);

  console.log("semesters: per-user period fields added + rules tightened");
}, (app) => {
  const collection = app.findCollectionByNameOrId(SEM_ID);
  for (const id of [
    "relation1787642001",
    "relation1787642002",
    "text1787642003",
    "number1787642004",
    "select1787642005",
    "bool1787642006",
  ]) {
    try {
      collection.fields.removeById(id);
    } catch (e) {
      /* skip */
    }
  }
  unmarshal({
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  }, collection);
  app.save(collection);
})
