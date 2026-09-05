/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lib_previews.js — helpers для lecture_previews.pb.js
//
//  ВАЖНО (грабля PocketBase JSVM): каждый обработчик хука
//  выполняется в ИЗОЛИРОВАННОМ scope — функции из верхнего
//  уровня файла в него не видны (ReferenceError). Общие
//  хелперы кладём отдельным .js-модулем и подключаем через
//  require(`${__hooks}/lib_previews.js`) ВНУТРИ каждого
//  обработчика.
// ============================================================

const PREVIEW_MAX = 400;

/** HTML → plain text: убрать теги и токены картинок, схлопнуть пробелы. */
function stripHtml(html) {
  return String(html || "")
    .replace(/\[\[file:[^\]]+\]\]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Включил ли пользователь `preview_enabled` для группы. */
function memberPreviewEnabled(app, groupId, userId) {
  if (!groupId || !userId) return false;
  const rows = app.findRecordsByFilter(
    "group_members",
    "group = {:g} && user = {:u}",
    "",
    1,
    0,
    { g: groupId, u: userId }
  );
  const m = rows && rows[0];
  return !!(m && m.get("preview_enabled"));
}

/** Создать / обновить / удалить строку превью под текущее состояние лекции. */
function syncPreviewForLecture(app, lecture) {
  const lectureId = lecture.id;
  const groupId = String(lecture.get("group") || "");
  const ownerId = String(lecture.get("owner") || "");

  const existing = app.findRecordsByFilter(
    "lecture_previews",
    "lecture = {:l}",
    "",
    1,
    0,
    { l: lectureId }
  );
  const row = existing && existing[0];

  const shouldShow =
    groupId && ownerId && memberPreviewEnabled(app, groupId, ownerId);

  if (!shouldShow) {
    if (row) app.delete(row);
    return;
  }

  const title = String(lecture.get("title") || "");
  const previewText = stripHtml(lecture.get("content")).slice(0, PREVIEW_MAX);

  if (row) {
    row.set("group", groupId);
    row.set("owner", ownerId);
    row.set("title", title);
    row.set("preview_text", previewText);
    app.save(row);
    return;
  }

  const col = app.findCollectionByNameOrId("lecture_previews");
  const fresh = new Record(col, {
    lecture: lectureId,
    group: groupId,
    owner: ownerId,
    title: title,
    preview_text: previewText,
  });
  app.save(fresh);
}

/** Пересобрать превью всех лекций пользователя в группе (смена preview_enabled). */
function resyncUserGroupPreviews(app, groupId, userId) {
  if (!groupId || !userId) return;
  const lectures = app.findRecordsByFilter(
    "lectures",
    "owner = {:u} && group = {:g}",
    "",
    500,
    0,
    { u: userId, g: groupId }
  );
  for (const lec of lectures) {
    if (lec) syncPreviewForLecture(app, lec);
  }
}

module.exports = {
  stripHtml,
  memberPreviewEnabled,
  syncPreviewForLecture,
  resyncUserGroupPreviews,
};
