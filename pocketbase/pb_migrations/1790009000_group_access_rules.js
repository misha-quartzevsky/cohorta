/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Волна C, этап 1 (21.10.2026) — проверка A0.5 по живой базе нашла дыры.
//
//  1. lecture_shares.createRule требовал только `owner = я`: любой вошедший
//     мог создать выдачу «я автор, получатель — я» на ЧУЖУЮ лекцию (id
//     угадан) и тем самым открыть её себе. Теперь лекция должна быть моей,
//     получатель не я; поменять лекцию, получателя или автора в выдаче нельзя.
//     (Что получатель состоит в общей группе с автором, проверяет хук
//     groups_access/groups_manage — правилом это не выразить.)
//  2. group_members.createRule `user = я` пускал в ЛЮБУЮ группу по id (без
//     кода), updateRule позволял «переехать» в чужую группу сменой поля
//     `group`, deleteRule — выйти в обход серверной логики. Теперь создание
//     и удаление закрыты (идут серверными маршрутами), правка — только
//     своего `preview_enabled`.
//  3. groups: создание только серверным маршрутом (код ставит сервер), правка —
//     только название/адрес владельцем (не owner, не invite_code), удаления
//     через API нет. invite_code помечен скрытым: ни список, ни просмотр, ни
//     фильтр его не отдают; владелец читает его маршрутом
//     GET /api/groups/{id}/invite.
//  4. lectures/courses/decks/deck_cards: ветка `owner = ""` («у записи нет
//     владельца — доступна всем, даже без входа») убрана. Запись без владельца
//     появляется, когда пользователя удаляют (relation owner обнуляется), и
//     лекция становилась публичной. Лекции без владельца, у которых есть
//     предмет, получают владельца предмета; остальные закрыты для всех.
//     Создать запись «за другого» и сменить владельца на чужого или пустого
//     нельзя.
//  5. Во всех правилах «я владелец» стояло без проверки входа: для гостя
//     `@request.auth.id` пуст, и запись с пустым владельцем совпадала с ним
//     (`owner = ""`). Теперь каждое правило начинается с `@request.auth.id != ""`.
//
//  Не тронуто и ждёт решения: коллекция `tags` целиком открыта (все правила пусты:
//  читать, создавать, менять и удалять может кто угодно, даже без входа); у неё
//  нет владельца, поэтому закрыть её можно только после решения по схеме.
//
//  Условия «закрыто, пока не доказано обратное».
//  DOWN возвращает все прежние правила и видимость invite_code.
// ============================================================

// Правила на момент до этой миграции (снято с базы). Для down.
const BASE = {
  "courses": {
    "listRule": "deleted_at = \"\" && (owner = \"\" || owner = @request.auth.id)",
    "viewRule": "deleted_at = \"\" && (owner = \"\" || owner = @request.auth.id)",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "deleted_at = \"\" && (owner = \"\" || owner = @request.auth.id)",
    "deleteRule": "owner = \"\" || owner = @request.auth.id"
  },
  "deck_cards": {
    "listRule": "deck.owner = \"\" || (@request.auth.id != \"\" && (deck.owner = @request.auth.id || deck.is_public = true))",
    "viewRule": "deck.owner = \"\" || (@request.auth.id != \"\" && (deck.owner = @request.auth.id || deck.is_public = true))",
    "createRule": "@request.auth.id != \"\" && deck.owner = @request.auth.id && (lecture = \"\" || lecture.owner = @request.auth.id)",
    "updateRule": "@request.auth.id != \"\" && deck.owner = @request.auth.id && (@request.body.lecture:isset = false || @request.body.lecture = \"\" || (@collection.lectures.id ?= @request.body.lecture && @collection.lectures.owner ?= @request.auth.id))",
    "deleteRule": "@request.auth.id != \"\" && deck.owner = @request.auth.id"
  },
  "decks": {
    "listRule": "owner = \"\" || (@request.auth.id != \"\" && (owner = @request.auth.id || is_public = true))",
    "viewRule": "owner = \"\" || (@request.auth.id != \"\" && (owner = @request.auth.id || is_public = true))",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "deleteRule": "@request.auth.id != \"\" && owner = @request.auth.id"
  },
  "deletion_requests": {
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "updateRule": null,
    "deleteRule": null
  },
  "exam_participants": {
    "listRule": "exam.owner = @request.auth.id || user = @request.auth.id",
    "viewRule": "exam.owner = @request.auth.id || user = @request.auth.id",
    "createRule": "exam.owner = @request.auth.id",
    "updateRule": null,
    "deleteRule": "exam.owner = @request.auth.id"
  },
  "exam_tickets": {
    "listRule": "exam.owner = @request.auth.id || (@collection.exam_participants.exam ?= exam && @collection.exam_participants.user ?= @request.auth.id)",
    "viewRule": "exam.owner = @request.auth.id || (@collection.exam_participants.exam ?= exam && @collection.exam_participants.user ?= @request.auth.id)",
    "createRule": "exam.owner = @request.auth.id",
    "updateRule": "exam.owner = @request.auth.id || author = @request.auth.id",
    "deleteRule": "exam.owner = @request.auth.id"
  },
  "exams": {
    "listRule": "owner = @request.auth.id || (@collection.exam_participants.exam ?= id && @collection.exam_participants.user ?= @request.auth.id)",
    "viewRule": "owner = @request.auth.id || (@collection.exam_participants.exam ?= id && @collection.exam_participants.user ?= @request.auth.id)",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  },
  "group_members": {
    "listRule": "user = @request.auth.id || group.owner = @request.auth.id || (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
    "viewRule": "user = @request.auth.id || group.owner = @request.auth.id || (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id || group.owner = @request.auth.id"
  },
  "groups": {
    "listRule": "owner = @request.auth.id || (@collection.group_members.group ?= id && @collection.group_members.user ?= @request.auth.id)",
    "viewRule": "owner = @request.auth.id || (@collection.group_members.group ?= id && @collection.group_members.user ?= @request.auth.id)",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  },
  "lecture_previews": {
    "listRule": "@request.auth.id != \"\" && (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
    "viewRule": "@request.auth.id != \"\" && (@collection.group_members.group ?= group && @collection.group_members.user ?= @request.auth.id)",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  },
  "lecture_shares": {
    "listRule": "owner = @request.auth.id || grantee = @request.auth.id",
    "viewRule": "owner = @request.auth.id || grantee = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  },
  "lectures": {
    "listRule": "deleted_at = \"\" && (owner = \"\" || owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id))",
    "viewRule": "deleted_at = \"\" && (owner = \"\" || owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id))",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "deleted_at = \"\" && (owner = \"\" || owner = @request.auth.id)",
    "deleteRule": "owner = \"\" || owner = @request.auth.id"
  },
  "premium_grants": {
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  },
  "quiz_answers": {
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id && (lecture.owner = @request.auth.id || (@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id))",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  },
  "quiz_questions": {
    "listRule": "lecture.deleted_at = \"\" && (lecture.owner = @request.auth.id || (@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id))",
    "viewRule": "lecture.deleted_at = \"\" && (lecture.owner = @request.auth.id || (@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id))",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id && lecture.owner = @request.auth.id",
    "updateRule": "lecture.owner = @request.auth.id",
    "deleteRule": "lecture.owner = @request.auth.id"
  },
  "quizzes": {
    "listRule": "lecture.deleted_at = \"\" && (lecture.owner = @request.auth.id || (@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id))",
    "viewRule": "lecture.deleted_at = \"\" && (lecture.owner = @request.auth.id || (@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id))",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id && lecture.owner = @request.auth.id",
    "updateRule": "lecture.owner = @request.auth.id",
    "deleteRule": "lecture.owner = @request.auth.id"
  },
  "schedule_settings": {
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  },
  "schedule_slot_lectures": {
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  },
  "schedule_slots": {
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  },
  "semesters": {
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id"
  },
  "tasks": {
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id"
  }
};

const SHARED_LECTURE =
  "(@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id)";
const KEEP_OWNER = '(@request.body.owner:isset = false || @request.body.owner = @request.auth.id)';
const CREATE_OWN = '@request.auth.id != "" && @request.body.owner = @request.auth.id';
const DECK_READ = '(owner = @request.auth.id || is_public = true)';
const DECK_CARD_READ = '(deck.owner = @request.auth.id || deck.is_public = true)';

// Новые правила тех коллекций, которые переписаны по смыслу (не только обёрнуты).
const OVERRIDE = {
  lectures: {
    listRule: `deleted_at = "" && (owner = @request.auth.id || ${SHARED_LECTURE})`,
    viewRule: `deleted_at = "" && (owner = @request.auth.id || ${SHARED_LECTURE})`,
    createRule: CREATE_OWN,
    updateRule: `deleted_at = "" && owner = @request.auth.id && ${KEEP_OWNER}`,
    deleteRule: "owner = @request.auth.id",
  },
  courses: {
    listRule: 'deleted_at = "" && owner = @request.auth.id',
    viewRule: 'deleted_at = "" && owner = @request.auth.id',
    createRule: CREATE_OWN,
    updateRule: `deleted_at = "" && owner = @request.auth.id && ${KEEP_OWNER}`,
    deleteRule: "owner = @request.auth.id",
  },
  decks: {
    listRule: `@request.auth.id != "" && ${DECK_READ}`,
    viewRule: `@request.auth.id != "" && ${DECK_READ}`,
    updateRule: `@request.auth.id != "" && owner = @request.auth.id && ${KEEP_OWNER}`,
  },
  deck_cards: {
    listRule: `@request.auth.id != "" && ${DECK_CARD_READ}`,
    viewRule: `@request.auth.id != "" && ${DECK_CARD_READ}`,
  },
  lecture_shares: {
    createRule:
      '@request.auth.id != "" && owner = @request.auth.id && lecture.owner = @request.auth.id && grantee != @request.auth.id',
    updateRule:
      'owner = @request.auth.id && lecture.owner = @request.auth.id && @request.body.lecture:isset = false && @request.body.grantee:isset = false && @request.body.owner:isset = false',
  },
  group_members: {
    createRule: null,
    updateRule:
      "user = @request.auth.id && @request.body.group:isset = false && @request.body.user:isset = false && @request.body.joined_at:isset = false",
    deleteRule: null,
  },
  groups: {
    createRule: null,
    updateRule:
      "owner = @request.auth.id && @request.body.owner:isset = false && @request.body.invite_code:isset = false",
    deleteRule: null,
  },
};

const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];
const GUARD = '@request.auth.id != ""';

/** Каждое правило начинается с проверки входа (пустой гость не равен «записи без владельца»). */
function guarded(rule) {
  if (rule === null || rule === undefined) return null;
  const r = String(rule);
  if (r.indexOf(GUARD) === 0) return r;
  return `${GUARD} && (${r})`;
}

migrate((app) => {
  // Лекции без владельца, но с предметом, получают владельца предмета.
  try {
    app.db().newQuery(
      "UPDATE lectures SET owner = (SELECT c.owner FROM courses c WHERE c.id = lectures.field) " +
        "WHERE (owner = '' OR owner IS NULL) AND field != '' AND field IS NOT NULL"
    ).execute();
  } catch (err) {
    console.log("lectures owner backfill skipped:", err);
  }

  for (const name of Object.keys(BASE)) {
    const c = app.findCollectionByNameOrId(name);
    for (const key of RULE_KEYS) {
      const over = OVERRIDE[name] && Object.prototype.hasOwnProperty.call(OVERRIDE[name], key);
      const next = over ? OVERRIDE[name][key] : BASE[name][key];
      c[key] = over && next === null ? null : guarded(next);
    }
    if (name === "groups") c.fields.getByName("invite_code").hidden = true;
    app.save(c);
  }

  // Превью для группы: только название (текст лекции больше не копируется).
  try {
    app.db().newQuery("UPDATE lecture_previews SET preview_text = ''").execute();
  } catch (err) {
    console.log("lecture_previews.preview_text not cleared:", err);
  }
}, (app) => {
  for (const name of Object.keys(BASE)) {
    const c = app.findCollectionByNameOrId(name);
    for (const key of RULE_KEYS) {
      c[key] = BASE[name][key] === undefined ? null : BASE[name][key];
    }
    if (name === "groups") c.fields.getByName("invite_code").hidden = false;
    app.save(c);
  }
})
