/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lectures += поля расписания (spec 2.3)
//
//  slot         → schedule_slots, необязательно, cascadeDelete:false
//                 (удалили слот — лекция остаётся, поле обнуляется)
//  lecture_date date, дата конкретной пары
//  number       number, порядковый номер лекции в предмете («Лекция 6»)
// ============================================================

const LECTURES_ID = "pbc_595999177";

function hasField(col, name) {
  for (const f of col.fields) if (f.name === name) return true;
  return false;
}

migrate((app) => {
  const collection = app.findCollectionByNameOrId(LECTURES_ID);

  if (!hasField(collection, "slot")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_1790000100",
      "hidden": false,
      "id": "relation1790000201",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "slot",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }));
  }

  if (!hasField(collection, "lecture_date")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "hidden": false,
      "id": "date1790000202",
      "max": "",
      "min": "",
      "name": "lecture_date",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }));
  }

  if (!hasField(collection, "number")) {
    collection.fields.addAt(collection.fields.length, new Field({
      "hidden": false,
      "id": "number1790000203",
      "max": null,
      "min": null,
      "name": "number",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }));
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId(LECTURES_ID);
  for (const name of ["slot", "lecture_date", "number"]) {
    const f = collection.fields.find((x) => x.name === name);
    if (f) collection.fields.removeById(f.id);
  }
  return app.save(collection);
})
