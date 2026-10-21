/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  B5 — deck_cards.lecture: необязательная связь карточки с лекцией
//  (форма «Новая карточка», Screen-forms-create, поле «Лекция · необязательно»).
//
//  - relation → lectures, одно значение, не обязательное;
//  - cascadeDelete: false — при удалении лекции карточка остаётся, поле очищается;
//  - существующие карточки не меняются (поле пустое);
//  - правила чтения не трогаем (владелец колоды, как после 1790001000);
//  - правила записи только СУЖАЕМ: выбранная лекция должна принадлежать
//    текущему пользователю, иначе поле не даёт доступа к чужой лекции.
//
//  Резервная копия pb_data: pocketbase/pb_backups/backup-before-deck-cards-lecture.
//  DOWN: убирает поле и возвращает правила записи 1790001000.
// ============================================================

const BASE_WRITE = "@request.auth.id != \"\" && deck.owner = @request.auth.id";
// Создание: проверяем лекцию создаваемой записи.
const OWN_LECTURE = "(lecture = \"\" || lecture.owner = @request.auth.id)";
// Изменение: в правиле `lecture` — старое значение, поэтому смотрим на присланное
// (@request.body.lecture) и ищем эту лекцию среди своих.
const OWN_LECTURE_UPDATE =
  "(@request.body.lecture:isset = false || @request.body.lecture = \"\" || " +
  "(@collection.lectures.id ?= @request.body.lecture && @collection.lectures.owner ?= @request.auth.id))";
const FIELD_ID = "relation1790008001";

migrate((app) => {
  const cards = app.findCollectionByNameOrId("deck_cards");
  const lectures = app.findCollectionByNameOrId("lectures");

  if (!cards.fields.getByName("lecture")) {
    cards.fields.addAt(
      cards.fields.length,
      new Field({
        cascadeDelete: false,
        collectionId: lectures.id,
        hidden: false,
        id: FIELD_ID,
        maxSelect: 1,
        minSelect: 0,
        name: "lecture",
        presentable: false,
        required: false,
        system: false,
        type: "relation",
      })
    );
  }

  cards.createRule = BASE_WRITE + " && " + OWN_LECTURE;
  cards.updateRule = BASE_WRITE + " && " + OWN_LECTURE_UPDATE;
  app.save(cards);
}, (app) => {
  const cards = app.findCollectionByNameOrId("deck_cards");
  cards.createRule = BASE_WRITE;
  cards.updateRule = BASE_WRITE;
  if (cards.fields.getById(FIELD_ID)) cards.fields.removeById(FIELD_ID);
  app.save(cards);
})
