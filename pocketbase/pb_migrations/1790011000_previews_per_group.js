/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Волна C, этап 2 (21.10.2026): предпросмотр показывает названия ВСЕХ лекций
//  автора в группе, где он включён, а не только лекций с привязкой `lectures.group`
//  (так в макетах «Одногруппники» и «Мой доступ»: переключатель на группу, не на
//  лекцию). Строка превью теперь на пару (лекция, группа): индекс по одной
//  лекции заменён на индекс по (лекция, группа). Схема полей не меняется.
//  DOWN возвращает индекс по лекции (если у лекции несколько строк — лишние удаляются).
// ============================================================

migrate((app) => {
  const c = app.findCollectionByNameOrId("lecture_previews");
  c.indexes = [
    "CREATE UNIQUE INDEX `idx_lecture_previews_lecture_group` ON `lecture_previews` (`lecture`, `group`)",
  ];
  app.save(c);
  // Пересобираем превью по новому правилу (все лекции автора в группах с включённым предпросмотром).
  try {
    const lib = require(`${__hooks}/lib_previews.js`);
    for (const m of app.findRecordsByFilter("group_members", "preview_enabled = true", "", 100000, 0, {})) {
      lib.resyncUserGroupPreviews(app, String(m.get("group")), String(m.get("user")));
    }
  } catch (err) {
    console.log("preview backfill skipped (rows appear when the owner toggles preview or edits a lecture):", err);
  }
}, (app) => {
  const rows = app.findRecordsByFilter("lecture_previews", "1 = 1", "created", 100000, 0, {});
  const first = {};
  for (const r of rows) {
    const k = String(r.get("lecture"));
    if (first[k]) app.delete(r);
    else first[k] = true;
  }
  const c = app.findCollectionByNameOrId("lecture_previews");
  c.indexes = ["CREATE UNIQUE INDEX `idx_lecture_previews_lecture` ON `lecture_previews` (`lecture`)"];
  app.save(c);
})
