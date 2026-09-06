/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  users — поля онбординга (профиль студента + флаг прохождения).
//
//    username             — обращение внутри Cohorta; unique (partial
//                           index WHERE username != '' — грандфазерные
//                           пустые не конфликтуют)
//    city                 — город обучения (фильтр вузов)
//    university           — relation → universities (если нашёлся)
//    university_custom     — свободный текст (если не нашёлся)
//    degree_level          — bachelor | specialist | master | other
//    degree_level_custom   — текст при "other"
//    course               — курс обучения (валидируется на фронте)
//    onboarding_completed — пока false, показываем мастер вместо приложения
//
//  Backfill: всем существующим пользователям onboarding_completed =
//  true (грандфазер — мастер проходят только новые регистрации).
// ============================================================

function hasField(col, name) {
  for (const f of col.fields) if (f.name === name) return true;
  return false;
}

const USERNAME_INDEX =
  "CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`) WHERE `username` != ''";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  if (!hasField(users, "username")) {
    users.fields.addAt(users.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1787643001",
      "max": 40,
      "min": 0,
      "name": "username",
      "pattern": "",
      "presentable": true,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }));
  }
  if (!hasField(users, "city")) {
    users.fields.addAt(users.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1787643002",
      "max": 120,
      "min": 0,
      "name": "city",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }));
  }
  if (!hasField(users, "university")) {
    users.fields.addAt(users.fields.length, new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_1787640000",
      "hidden": false,
      "id": "relation1787643003",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "university",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }));
  }
  if (!hasField(users, "university_custom")) {
    users.fields.addAt(users.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1787643004",
      "max": 255,
      "min": 0,
      "name": "university_custom",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }));
  }
  if (!hasField(users, "degree_level")) {
    users.fields.addAt(users.fields.length, new Field({
      "hidden": false,
      "id": "select1787643005",
      "maxSelect": 1,
      "name": "degree_level",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": ["bachelor", "specialist", "master", "other"]
    }));
  }
  if (!hasField(users, "degree_level_custom")) {
    users.fields.addAt(users.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1787643006",
      "max": 120,
      "min": 0,
      "name": "degree_level_custom",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }));
  }
  if (!hasField(users, "course")) {
    users.fields.addAt(users.fields.length, new Field({
      "hidden": false,
      "id": "number1787643007",
      "max": null,
      "min": null,
      "name": "course",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }));
  }
  if (!hasField(users, "onboarding_completed")) {
    users.fields.addAt(users.fields.length, new Field({
      "hidden": false,
      "id": "bool1787643008",
      "name": "onboarding_completed",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }));
  }

  if (users.indexes.indexOf(USERNAME_INDEX) === -1) {
    users.indexes.push(USERNAME_INDEX);
  }

  app.save(users);

  // --- Backfill: грандфазер существующих аккаунтов ---
  const rows = app.findRecordsByFilter("users", "id != \"\"", "", 5000, 0);
  let done = 0;
  for (const row of rows) {
    if (row.get("onboarding_completed") === true) continue;
    row.set("onboarding_completed", true);
    app.save(row);
    done++;
  }
  console.log(`users: onboarding fields added; grandfathered ${done} existing accounts`);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  for (const id of [
    "text1787643001",
    "text1787643002",
    "relation1787643003",
    "text1787643004",
    "select1787643005",
    "text1787643006",
    "number1787643007",
    "bool1787643008",
  ]) {
    try {
      users.fields.removeById(id);
    } catch (e) {
      /* skip */
    }
  }
  const idx = users.indexes.indexOf(USERNAME_INDEX);
  if (idx !== -1) users.indexes.splice(idx, 1);
  app.save(users);
})
