/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  B5 — квиз принадлежит лекции, а не пользователю.
//
//  quizzes, quiz_questions: читают владелец лекции и тот, кому лекция открыта
//  (lecture_shares; снят доступ — квиз скрыт); создаёт, меняет и удаляет
//  только владелец лекции.
//  quiz_answers: читает/меняет/удаляет только автор ответа; создать ответ
//  можно только к вопросу лекции, к которой есть доступ.
//  Условия «закрыто, пока не доказано обратное».
// ============================================================

const IS_LECTURE_OWNER = "lecture.owner = @request.auth.id";
const HAS_SHARE =
  "(@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id)";
const CAN_READ = `${IS_LECTURE_OWNER} || ${HAS_SHARE}`;

const OLD = {
  createRule: '@request.auth.id != "" && owner = @request.auth.id',
  updateRule: "owner = @request.auth.id",
  deleteRule: "owner = @request.auth.id",
  listRule: "owner = @request.auth.id",
  viewRule: "owner = @request.auth.id",
};

const NEW = {
  quizzes: {
    createRule: `@request.auth.id != "" && owner = @request.auth.id && ${IS_LECTURE_OWNER}`,
    updateRule: IS_LECTURE_OWNER,
    deleteRule: IS_LECTURE_OWNER,
    listRule: CAN_READ,
    viewRule: CAN_READ,
  },
  quiz_questions: {
    createRule: `@request.auth.id != "" && owner = @request.auth.id && ${IS_LECTURE_OWNER}`,
    updateRule: IS_LECTURE_OWNER,
    deleteRule: IS_LECTURE_OWNER,
    listRule: CAN_READ,
    viewRule: CAN_READ,
  },
  quiz_answers: {
    createRule:
      '@request.auth.id != "" && owner = @request.auth.id && ' +
      "(lecture.owner = @request.auth.id || " +
      "(@collection.lecture_shares.lecture ?= lecture && @collection.lecture_shares.grantee ?= @request.auth.id))",
  },
};

function apply(app, rules) {
  for (const [name, set] of Object.entries(rules)) {
    const col = app.findCollectionByNameOrId(name);
    for (const [k, v] of Object.entries(set)) col[k] = v;
    app.save(col);
  }
}

migrate(
  (app) => apply(app, NEW),
  (app) =>
    apply(app, {
      quizzes: OLD,
      quiz_questions: OLD,
      quiz_answers: { createRule: OLD.createRule },
    })
);
