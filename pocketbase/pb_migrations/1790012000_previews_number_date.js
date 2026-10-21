/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Волна C, этап 2 (21.10.2026): в предпросмотре чужой лекции видны номер и дата
//  («Лекция 5 · 11 окт», Screen-group-member, Screen-m-group-people).
//
//    lecture_previews.lecture_number   number, порядковый номер лекции в предмете
//    lecture_previews.lecture_date     date, дата пары
//
//  Поля лежат в той же записи, что и название, поэтому видны только там, где виден
//  предпросмотр (правила коллекции не менялись). Текст лекции по-прежнему не копируется.
//  Существующие строки заполняются из лекций; новые и изменённые — хуком lib_previews.js.
//  DOWN убирает оба поля.
// ============================================================

migrate((app) => {
  const previews = app.findCollectionByNameOrId("lecture_previews");
  previews.fields.add(new NumberField({ name: "lecture_number", min: 0 }));
  previews.fields.add(new DateField({ name: "lecture_date" }));
  app.save(previews);

  app
    .db()
    .newQuery(
      "UPDATE lecture_previews SET " +
        "lecture_number = COALESCE((SELECT number FROM lectures WHERE lectures.id = lecture_previews.lecture), 0), " +
        "lecture_date = COALESCE((SELECT lecture_date FROM lectures WHERE lectures.id = lecture_previews.lecture), '')"
    )
    .execute();
}, (app) => {
  const previews = app.findCollectionByNameOrId("lecture_previews");
  for (const f of ["lecture_number", "lecture_date"]) previews.fields.removeByName(f);
  app.save(previews);
})
