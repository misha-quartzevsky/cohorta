/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  UP: drop legacy (empty) WIP collections card_sets / cards.
//  These came from the old WIP fork; the current module uses
//  `decks` / `deck_cards` instead. Collections are empty, so a
//  plain drop is safe. Guard with try/catch — the collection may
//  not exist on a fresh database (findCollectionByNameOrId throws
//  `sql: no rows in result set` when absent).
// ============================================================

migrate((app) => {
  // `cards` references `card_sets` — удаляем зависимую коллекцию первой.
  for (const name of ["cards", "card_sets"]) {
    let col = null
    try {
      col = app.findCollectionByNameOrId(name)
    } catch (e) {
      col = null
    }
    if (col) {
      app.delete(col)
      console.log("removed legacy collection: " + name)
    }
  }
}, (app) => {
  // DOWN: не восстанавливаем — legacy-коллекции пусты и не нужны.
  console.log("legacy removal rolled back (collections not recreated)")
})
