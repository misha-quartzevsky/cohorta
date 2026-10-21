/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lib_previews.js — helpers для lecture_previews.pb.js
//
//  Предпросмотр хранится на членстве (group_members.preview_enabled) и у
//  каждой группы свой: когда автор включил его для группы, в этой группе
//  видны НАЗВАНИЯ всех его лекций (не текст) и название/обложка предмета.
//  Строка превью — на пару (лекция, группа). Лекция в корзине не видна.
//
//  ВАЖНО (грабля PocketBase JSVM): обработчик хука выполняется в
//  изолированном scope — общие функции подключаются через
//  require(`${__hooks}/lib_previews.js`) ВНУТРИ обработчика.
// ============================================================

/** Группы автора, где он включил предпросмотр. */
function enabledGroups(app, userId) {
  if (!userId) return [];
  const rows = app.findRecordsByFilter("group_members", "user = {:u} && preview_enabled = true", "", 200, 0, { u: userId });
  return rows.map((m) => String(m.get("group")));
}

function previewRow(app, lectureId, groupId) {
  const rows = app.findRecordsByFilter("lecture_previews", "lecture = {:l} && group = {:g}", "", 1, 0, { l: lectureId, g: groupId });
  return rows && rows[0] ? rows[0] : null;
}

/** Название и обложка предмета лекции. */
function courseInfo(app, lecture) {
  const cid = String(lecture.get("field") || "");
  if (!cid) return { title: "", id: "", seed: 0 };
  try {
    const c = app.findRecordById("courses", cid);
    return { title: String(c.get("name") || ""), id: c.id, seed: Number(c.get("cover_seed") || 0) };
  } catch (err) {
    return { title: "", id: "", seed: 0 };
  }
}

/** Привести строки превью лекции к текущему состоянию: по строке на каждую группу с включённым предпросмотром. */
function syncPreviewForLecture(app, lecture) {
  const ownerId = String(lecture.get("owner") || "");
  const inTrash = String(lecture.get("deleted_at") || "") !== "";
  const want = inTrash || !ownerId ? [] : enabledGroups(app, ownerId);

  // лишние строки (группа выключена, лекция в корзине) — удалить
  const existing = app.findRecordsByFilter("lecture_previews", "lecture = {:l}", "", 200, 0, { l: lecture.id });
  for (const row of existing) {
    if (want.indexOf(String(row.get("group"))) < 0) app.delete(row);
  }
  if (want.length === 0) return;

  const info = courseInfo(app, lecture);
  const title = String(lecture.get("title") || "");
  // номер и дата пары: не текст лекции, показываются в строке «Лекция 5 · 11 окт»
  const number = Number(lecture.get("number") || 0);
  const lectureDate = String(lecture.get("lecture_date") || "");
  const col = app.findCollectionByNameOrId("lecture_previews");
  for (const groupId of want) {
    const row = previewRow(app, lecture.id, groupId);
    // Для группы видно только название: текст лекции в превью не копируется.
    if (row) {
      row.set("owner", ownerId);
      row.set("title", title);
      row.set("preview_text", "");
      row.set("course_title", info.title);
      row.set("course", info.id);
      row.set("cover_seed", info.seed);
      row.set("lecture_number", number);
      row.set("lecture_date", lectureDate);
      app.save(row);
    } else {
      app.save(
        new Record(col, {
          lecture: lecture.id,
          group: groupId,
          owner: ownerId,
          title: title,
          preview_text: "",
          course_title: info.title,
          course: info.id,
          cover_seed: info.seed,
          lecture_number: number,
          lecture_date: lectureDate,
        })
      );
    }
  }
}

/** Пересобрать превью всех лекций пользователя (смена preview_enabled в одной из его групп). */
function resyncUserGroupPreviews(app, groupId, userId) {
  if (!groupId || !userId) return;
  const lectures = app.findRecordsByFilter("lectures", "owner = {:u}", "", 5000, 0, { u: userId });
  for (const lec of lectures) {
    if (lec) syncPreviewForLecture(app, lec);
  }
  // строки этой группы у лекций, которых нет в выборке (удалены физически), каскадом уйдут сами
}

module.exports = {
  enabledGroups,
  syncPreviewForLecture,
  resyncUserGroupPreviews,
};
