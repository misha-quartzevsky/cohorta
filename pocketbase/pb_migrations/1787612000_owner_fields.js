/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  courses / decks / lectures — поле `owner` (+ `group` у lectures).
//
//  До сих пор эти коллекции были полностью открыты (`listRule ""`,
//  без владельца) — любой залогиненный пользователь видел курсы,
//  лекции и колоды всех остальных. Для пилота на 60 человек это
//  блокер: личное пространство обязано быть личным.
//
//  Здесь только ДОБАВЛЯЕМ поля (правила ужесточаются отдельной
//  миграцией 1787615000, когда появятся зависимые коллекции
//  lecture_shares / lecture_previews). Legacy-строки остаются с
//  пустым `owner` и по будущему правилу `owner = "" || …` видны
//  всем — это осознанный переходный режим (демо-данные, старые
//  записи), новые записи получают владельца в сервисах и сиде.
//
//  `owner` — опциональный (`minSelect: 0`), `cascadeDelete: false`:
//  удаление пользователя не должно сносить общие/легаси-данные.
// ============================================================

function hasField(col, name) {
  for (const f of col.fields) {
    if (f.name === name) return true;
  }
  return false;
}

function ownerField(id) {
  return new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "hidden": false,
    "id": id,
    "maxSelect": 1,
    "minSelect": 0,
    "name": "owner",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  });
}

migrate((app) => {
  const courses = app.findCollectionByNameOrId("courses");
  if (!hasField(courses, "owner")) {
    courses.fields.addAt(courses.fields.length, ownerField("relation1787612001"));
    app.save(courses);
  }

  const decks = app.findCollectionByNameOrId("decks");
  if (!hasField(decks, "owner")) {
    decks.fields.addAt(decks.fields.length, ownerField("relation1787612002"));
    app.save(decks);
  }

  const lectures = app.findCollectionByNameOrId("lectures");
  if (!hasField(lectures, "owner")) {
    lectures.fields.addAt(lectures.fields.length, ownerField("relation1787612003"));
  }
  if (!hasField(lectures, "group")) {
    lectures.fields.addAt(lectures.fields.length, new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_1787610000",
      "hidden": false,
      "id": "relation1787612004",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "group",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }));
  }
  app.save(lectures);

  const sample = app
    .findRecordsByFilter("lectures", "owner = ''", "", 500, 0)
    .length;
  console.log(`owner fields added; lectures without owner (up to 500): ${sample}`);
}, (app) => {
  for (const [name, ids] of [
    ["courses", ["relation1787612001"]],
    ["decks", ["relation1787612002"]],
    ["lectures", ["relation1787612003", "relation1787612004"]],
  ]) {
    const col = app.findCollectionByNameOrId(name);
    for (const id of ids) {
      try {
        col.fields.removeById(id);
      } catch (e) {
        /* skip */
      }
    }
    app.save(col);
  }
})
