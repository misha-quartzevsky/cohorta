/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  UP: decks — slug/description/is_public;
//      deck_cards — front/back text → richtext (editor) +
//      attachments (file).
// ============================================================

function hasField(col, name) {
  for (const f of col.fields) {
    if (f.name === name) return true
  }
  return false
}

function removeTextField(col, id, name) {
  for (const f of col.fields) {
    if (f.id === id || (f.name === name && f.type === "text")) {
      col.fields.removeById(f.id)
      return true
    }
  }
  return false
}

migrate((app) => {
  // ---- 1. decks: slug / description / is_public ----
  const decks = app.findCollectionByNameOrId("decks")

  if (!hasField(decks, "slug")) {
    decks.fields.addAt(decks.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1787300001",
      "max": 0,
      "min": 0,
      "name": "slug",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
  }
  if (!hasField(decks, "description")) {
    decks.fields.addAt(decks.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1787300002",
      "max": 0,
      "min": 0,
      "name": "description",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
  }
  if (!hasField(decks, "is_public")) {
    decks.fields.addAt(decks.fields.length, new Field({
      "hidden": false,
      "id": "bool1787300003",
      "name": "is_public",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }))
  }
  app.save(decks)

  // ---- 2. deck_cards: front/back → editor + attachments file ----
  const cards = app.findCollectionByNameOrId("deck_cards")
  removeTextField(cards, "text6620395819", "front")
  removeTextField(cards, "text9847312065", "back")
  app.save(cards)

  const cards2 = app.findCollectionByNameOrId("deck_cards")
  if (!hasField(cards2, "front")) {
    cards2.fields.addAt(cards2.fields.length, new Field({
      "convertURLs": false,
      "hidden": false,
      "id": "editor1787300005",
      "maxSize": 0,
      "name": "front",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "editor"
    }))
  }
  if (!hasField(cards2, "back")) {
    cards2.fields.addAt(cards2.fields.length, new Field({
      "convertURLs": false,
      "hidden": false,
      "id": "editor1787300006",
      "maxSize": 0,
      "name": "back",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "editor"
    }))
  }
  if (!hasField(cards2, "attachments")) {
    cards2.fields.addAt(cards2.fields.length, new Field({
      "hidden": false,
      "id": "file1787300007",
      "maxSelect": 0,
      "maxSize": 0,
      "mimeTypes": [],
      "name": "attachments",
      "presentable": false,
      "protected": false,
      "required": false,
      "system": false,
      "thumbs": [],
      "type": "file"
    }))
  }
  app.save(cards2)

  console.log("decks upgraded: slug/description/is_public; deck_cards front/back richtext + attachments")
}, (app) => {
  // ---- DOWN: восстановление text front/back, снятие новых полей ----
  const decks = app.findCollectionByNameOrId("decks")
  for (const id of ["text1787300001", "text1787300002", "bool1787300003"]) {
    try {
      decks.fields.removeById(id)
    } catch (e) { /* skip */ }
  }
  app.save(decks)

  const cards = app.findCollectionByNameOrId("deck_cards")
  for (const id of ["editor1787300005", "editor1787300006", "file1787300007"]) {
    try {
      cards.fields.removeById(id)
    } catch (e) { /* skip */ }
  }
  if (!hasField(cards, "front")) {
    cards.fields.addAt(cards.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text6620395819",
      "max": 0,
      "min": 0,
      "name": "front",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    }))
  }
  if (!hasField(cards, "back")) {
    cards.fields.addAt(cards.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text9847312065",
      "max": 0,
      "min": 0,
      "name": "back",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    }))
  }
  app.save(cards)
  console.log("decks upgraded — rolled back")
})
