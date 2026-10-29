/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Аудит безопасности 2026-10, волна 1: A-4, A-5, A-6, A-7.
//
//  Правило updateRule проверяло прежнего владельца записи и не запрещало менять владельца или
//  родителя, поэтому свою запись можно было подбросить в чужой контейнер: квиз в чужую лекцию,
//  карточку в чужую публичную колоду, билет в чужой экзамен, задачу в чужой аккаунт.
//  К каждому updateRule добавляется `@request.body.<поле>:isset = false` для неизменяемых полей:
//
//    quizzes                 lecture, owner
//    quiz_questions          lecture, quiz, owner
//    quiz_answers            owner, lecture, question
//    deck_cards              deck
//    exam_tickets            exam (во всех ветках правила)
//    tasks, schedule_slots, schedule_settings   owner
//    schedule_slot_lectures  owner, slot, lecture
//    semesters               user
//    exams                   owner
//
//  Клиент этих полей при правке не отправляет (проверено grep по apps/web/src), серверные хуки пишут
//  через app.save в обход правил. Прежнее правило берётся в скобки: `(было) && защита`.
//  DOWN снимает ровно добавленный хвост и возвращает прежний текст правила; повторный запуск
//  UP ничего не меняет.
// ============================================================

const GUARDED = {
  quizzes: ["lecture", "owner"],
  quiz_questions: ["lecture", "quiz", "owner"],
  quiz_answers: ["owner", "lecture", "question"],
  deck_cards: ["deck"],
  exam_tickets: ["exam"],
  tasks: ["owner"],
  schedule_slots: ["owner"],
  schedule_settings: ["owner"],
  schedule_slot_lectures: ["owner", "slot", "lecture"],
  semesters: ["user"],
  exams: ["owner"],
};

const tail = (fields) => " && " + fields.map((f) => `@request.body.${f}:isset = false`).join(" && ");

migrate((app) => {
  for (const [name, fields] of Object.entries(GUARDED)) {
    const col = app.findCollectionByNameOrId(name);
    if (col.updateRule === null || col.updateRule === undefined) continue;
    const rule = String(col.updateRule);
    if (rule.endsWith(tail(fields))) continue;
    col.updateRule = `(${rule})${tail(fields)}`;
    app.save(col);
  }
}, (app) => {
  for (const [name, fields] of Object.entries(GUARDED)) {
    const col = app.findCollectionByNameOrId(name);
    // updateRule в JSVM приходит не примитивной строкой (typeof даёт не "string"), поэтому приводим явно
    if (col.updateRule === null || col.updateRule === undefined) continue;
    const rule = String(col.updateRule);
    const t = tail(fields);
    if (rule.startsWith("(") && rule.endsWith(")" + t)) {
      col.updateRule = rule.slice(1, rule.length - t.length - 1);
      app.save(col);
    }
  }
});
