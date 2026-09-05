/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lecture_previews.pb.js — первый серверный хук проекта.
//
//  Ведёт коллекцию `lecture_previews` (thumbnail чужой лекции
//  для участников группы) из двух источников:
//
//   1. lectures create/update — если у лекции задана `group` и
//      автор (`owner`) включил `preview_enabled` для этой группы,
//      кладём/обновляем строку превью (заголовок + ~400 символов
//      plain-text). Иначе — удаляем строку, если была.
//      (Удаление лекции строку сносит каскадом — cascadeDelete
//      у lecture_previews.lecture, отдельный хук не нужен.)
//
//   2. group_members update — при смене `preview_enabled` заново
//      синхронизируем все лекции этого пользователя в этой группе.
//
//  Хелперы — в lib_previews.js, подключаются require() ВНУТРИ
//  каждого обработчика (JSVM изолирует scope обработчиков).
//  Хук пишет через app.save(...) в обход API-правил, поэтому
//  API create/update/delete у lecture_previews закрыты.
// ============================================================

onRecordAfterCreateSuccess((e) => {
  try {
    const p = require(`${__hooks}/lib_previews.js`);
    p.syncPreviewForLecture(e.app, e.record);
  } catch (err) {
    console.log("[lecture_previews] create sync failed:", err);
  }
  e.next();
}, "lectures");

onRecordAfterUpdateSuccess((e) => {
  try {
    const p = require(`${__hooks}/lib_previews.js`);
    p.syncPreviewForLecture(e.app, e.record);
  } catch (err) {
    console.log("[lecture_previews] update sync failed:", err);
  }
  e.next();
}, "lectures");

onRecordAfterUpdateSuccess((e) => {
  try {
    const p = require(`${__hooks}/lib_previews.js`);
    p.resyncUserGroupPreviews(
      e.app,
      String(e.record.get("group") || ""),
      String(e.record.get("user") || "")
    );
  } catch (err) {
    console.log("[lecture_previews] group_members sync failed:", err);
  }
  e.next();
}, "group_members");
