/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  B3 — decks.subject: необязательная связь колоды с предметом
//  (форма «Новая колода», Screen-forms-create). Колоды без предмета
//  остаются как есть (поле пустое). При полном удалении предмета
//  связь обнуляется, колода не удаляется (cascadeDelete: false).
//
//  НЕ ПРИМЕНЕНА. Лежит вне pb_migrations, потому что PocketBase
//  накатывает всё из pb_migrations при старте. Перед применением:
//  1) резервная копия pb_data (pocketbase/pb_backups/backup-before-decks-subject),
//  2) «ок» владелицы,
//  3) git mv в pb_migrations, перезапуск PocketBase,
//  4) на клиенте включить DECK_SUBJECT_SUPPORTED в services/deckService.ts.
// ============================================================

migrate((app) => {
  const decks = app.findCollectionByNameOrId("decks");
  const courses = app.findCollectionByNameOrId("courses");

  for (const f of decks.fields) {
    if (f.name === "subject") return; // уже есть
  }

  decks.fields.addAt(
    decks.fields.length,
    new Field({
      cascadeDelete: false,
      collectionId: courses.id,
      hidden: false,
      id: "relation1790007001",
      maxSelect: 1,
      minSelect: 0,
      name: "subject",
      presentable: false,
      required: false,
      system: false,
      type: "relation",
    })
  );
  app.save(decks);
}, (app) => {
  const decks = app.findCollectionByNameOrId("decks");
  decks.fields.removeById("relation1790007001");
  app.save(decks);
})
