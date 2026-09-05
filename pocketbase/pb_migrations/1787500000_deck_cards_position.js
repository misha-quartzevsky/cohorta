/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  UP: deck_cards — числовое поле `position` для ручного
//      порядка карточек (drag-n-drop в редакторе колоды).
//
//  Бэкфилл не делаем: у старых строк `position` остаётся пустым,
//  а `fetchDeckCards` сортирует `position,created` — пустые
//  позиции честно откатываются на прежний порядок `created`.
//  Реальные номера 0..N карточки получат при первом сохранении
//  колоды из редактора.
// ============================================================

function hasField(col, name) {
  for (const f of col.fields) {
    if (f.name === name) return true
  }
  return false
}

migrate((app) => {
  const cards = app.findCollectionByNameOrId("deck_cards")

  if (!hasField(cards, "position")) {
    cards.fields.addAt(cards.fields.length, new Field({
      "hidden": false,
      "id": "number1787500001",
      "max": null,
      "min": null,
      "name": "position",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
  }
  app.save(cards)

  console.log("deck_cards: added `position` field")
}, (app) => {
  const cards = app.findCollectionByNameOrId("deck_cards")
  try {
    cards.fields.removeById("number1787500001")
  } catch (e) { /* skip */ }
  app.save(cards)
  console.log("deck_cards: `position` rolled back")
})
