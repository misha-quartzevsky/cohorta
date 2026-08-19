/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ============================================================
  //  UP: `lectures.content` становится richtext (editor) вместо
  //      дубля content (text) + content_rich (editor).
  //  Данные берутся из content_rich; legacy plain-text content
  //      удаляется как ненужный (все лекции уже пишут rich-HTML).
  // ============================================================

  const collection = app.findCollectionByNameOrId("lectures")

  // 1. Убираем legacy plain-text `content` (text), чтобы освободить имя.
  collection.fields.removeById("text4274335913")
  app.save(collection)

  // 2. Добавляем richtext `content`.
  const col2 = app.findCollectionByNameOrId("lectures")
  col2.fields.addAt(col2.fields.length, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor1787200001",
    "maxSize": 0,
    "name": "content",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))
  app.save(col2)

  // 3. Переносим данные: content_rich → content.
  const records = app.findRecordsByFilter("lectures", "", "-created", 0, 0)
  for (const rec of records) {
    const rich = rec.get("content_rich") || ""
    if (rich) {
      rec.set("content", rich)
      app.save(rec)
    }
  }

  // 4. Убираем старый richtext content_rich.
  const col3 = app.findCollectionByNameOrId("lectures")
  col3.fields.removeById("editor1739553647")
  app.save(col3)

  console.log("lectures.content is now richtext; content_rich removed")
}, (app) => {
  // ============================================================
  //  DOWN: восстановление исходной схемы (content text + content_rich).
  // ============================================================
  const collection = app.findCollectionByNameOrId("lectures")

  // 1. Временное поле, чтобы не потерять richtext-данные.
  collection.fields.addAt(collection.fields.length, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor1787200099",
    "maxSize": 0,
    "name": "content_tmp",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))
  app.save(collection)

  // 2. Копируем content → content_tmp.
  const recs = app.findRecordsByFilter("lectures", "", "-created", 0, 0)
  for (const rec of recs) {
    rec.set("content_tmp", rec.get("content") || "")
    app.save(rec)
  }

  // 3. Убираем richtext `content`, добавляем text `content` и richtext `content_rich`.
  const col2 = app.findCollectionByNameOrId("lectures")
  col2.fields.removeById("editor1787200001")
  app.save(col2)

  const col3 = app.findCollectionByNameOrId("lectures")
  col3.fields.addAt(col3.fields.length, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text4274335913",
    "max": 0,
    "min": 0,
    "name": "content",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))
  col3.fields.addAt(col3.fields.length, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor1739553647",
    "maxSize": 0,
    "name": "content_rich",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))
  app.save(col3)

  // 4. Копируем данные обратно и убираем временное поле.
  const recs2 = app.findRecordsByFilter("lectures", "", "-created", 0, 0)
  for (const rec of recs2) {
    const v = rec.get("content_tmp") || ""
    rec.set("content_rich", v)
    rec.set("content", v)
    app.save(rec)
  }

  const col4 = app.findCollectionByNameOrId("lectures")
  col4.fields.removeById("editor1787200099")
  app.save(col4)

  console.log("Restored lectures.content (text) + content_rich")
})
