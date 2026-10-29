/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Аудит безопасности 2026-10, волна 1: A-9 / B-2 (без protected).
//
//  Файловые поля принимали любой тип и размер, а users.avatar ещё и image/svg+xml.
//  Клиент грузит только картинки (редактор: accept="image/*", аватар в мастере), поэтому:
//
//    lectures.file, deck_cards.attachments, exam_tickets.attachments:
//        mimeTypes jpeg/png/gif/webp/avif, maxSize 5 МБ (прежний неявный предел PocketBase), maxSelect 99
//    users.avatar: mimeTypes jpeg/png/gif/webp (без svg), maxSize 5 МБ
//
//  maxSelect: у вложений карточки и билета было 0, и PocketBase при нескольких файлах молча
//  сохранял только последний; клиент (deckService, examService) дописывает файлы к существующим
//  и ждёт поведения lectures.file (99). Ограничения проверяются при загрузке; уже сохранённые
//  файлы не затрагиваются.
//  protected НЕ включается: нужны файловые токены и обновление ссылок в HTML лекций
//  (см. docs/review/security-2026-10.md, «Волна 1: варианты»).
//
//  DOWN возвращает точно прежние параметры (значения записаны ниже).
// ============================================================

const IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
// maxSize 0 в PocketBase означает лимит по умолчанию 5 МБ, поэтому потолок остаётся 5 МБ (не ослабляем)
const FIVE_MB = 5 * 1024 * 1024;
// lectures.file принимает и то, что реально грузит клиент: схемы Excalidraw (svg, SketchModal) и аудиозаписи (SpeechProvider)
const LECTURE_FILES = [...IMAGES, "image/svg+xml", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/x-m4a", "video/webm", "video/mp4", "application/ogg"]; // PocketBase определяет тип по содержимому: аудио в контейнере webm/mp4 приходит как video/*

const PLAN = [
  { col: "lectures", field: "file", was: { mimeTypes: [], maxSize: 0, maxSelect: 99 }, now: { mimeTypes: LECTURE_FILES, maxSize: FIVE_MB, maxSelect: 99 } },
  { col: "deck_cards", field: "attachments", was: { mimeTypes: [], maxSize: 0, maxSelect: 0 }, now: { mimeTypes: IMAGES, maxSize: FIVE_MB, maxSelect: 99 } },
  { col: "exam_tickets", field: "attachments", was: { mimeTypes: [], maxSize: 0, maxSelect: 0 }, now: { mimeTypes: IMAGES, maxSize: FIVE_MB, maxSelect: 99 } },
  {
    col: "users",
    field: "avatar",
    was: { mimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"], maxSize: 0, maxSelect: 1 },
    now: { mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"], maxSize: FIVE_MB, maxSelect: 1 },
  },
];

const apply = (app, key) => {
  for (const p of PLAN) {
    const col = app.findCollectionByNameOrId(p.col);
    const f = col.fields.getByName(p.field);
    f.mimeTypes = p[key].mimeTypes;
    f.maxSize = p[key].maxSize;
    f.maxSelect = p[key].maxSelect;
    app.save(col);
  }
};

migrate((app) => apply(app, "now"), (app) => apply(app, "was"));
