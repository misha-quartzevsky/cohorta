/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exams / exam_tickets — доступ участникам коллективного экзамена.
//
//  exams: организатор видит свой экзамен всегда; добавленный
//  участник (`exam_participants`) — тоже. `createRule` не трогаем:
//  UNIQUE(course, owner) и так позволяет параллельные экзамены
//  разных организаторов на один курс.
//
//  exam_tickets: организатор — всё; участник — ВОПРОСЫ билетов
//  своего экзамена (read). Отдельный слой — ответы (`answer`):
//  их редактирует организатор или назначенный автор (`author`);
//  на ЧТЕНИЕ ответа стоит Proof-of-Knowledge (хук exam_pok.pb.js):
//  участник видит чужой `answer` только после того, как сам
//  заполнил ответ хотя бы на один свой назначенный билет.
//
//  DOWN возвращает правила к чисто owner-scoped.
// ============================================================

const EXAM_READ =
  "owner = @request.auth.id || (@collection.exam_participants.exam ?= id && @collection.exam_participants.user ?= @request.auth.id)";
const TICKET_READ =
  "exam.owner = @request.auth.id || (@collection.exam_participants.exam ?= exam && @collection.exam_participants.user ?= @request.auth.id)";
const TICKET_WRITE =
  "exam.owner = @request.auth.id || author = @request.auth.id";

migrate((app) => {
  const exams = app.findCollectionByNameOrId("exams");
  unmarshal({ listRule: EXAM_READ, viewRule: EXAM_READ }, exams);
  app.save(exams);

  const tickets = app.findCollectionByNameOrId("exam_tickets");
  unmarshal(
    {
      listRule: TICKET_READ,
      viewRule: TICKET_READ,
      updateRule: TICKET_WRITE,
    },
    tickets
  );
  app.save(tickets);

  console.log("exams/exam_tickets: participant read access enabled (PoK via hook)");
}, (app) => {
  const exams = app.findCollectionByNameOrId("exams");
  unmarshal(
    { listRule: "owner = @request.auth.id", viewRule: "owner = @request.auth.id" },
    exams
  );
  app.save(exams);

  const tickets = app.findCollectionByNameOrId("exam_tickets");
  unmarshal(
    {
      listRule: "exam.owner = @request.auth.id",
      viewRule: "exam.owner = @request.auth.id",
      updateRule: "exam.owner = @request.auth.id",
    },
    tickets
  );
  app.save(tickets);
})
