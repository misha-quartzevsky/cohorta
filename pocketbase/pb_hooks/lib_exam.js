/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lib_exam.js — helpers для exam_pok.pb.js
//
//  ГРАБЛЯ PocketBase JSVM: обработчик хука — изолированный scope,
//  функции верхнего уровня файла в нём не видны. Хелперы —
//  отдельный модуль, подключается require(`${__hooks}/lib_exam.js`)
//  ВНУТРИ обработчика.
// ============================================================

/**
 * Прошёл ли пользователь Proof-of-Knowledge для экзамена:
 * заполнил ответ хотя бы на один свой назначенный билет
 * (`author = user && answer != ""`).
 */
function passedProofOfKnowledge(app, examId, userId) {
  if (!examId || !userId) return false;
  const rows = app.findRecordsByFilter(
    "exam_tickets",
    'exam = {:e} && author = {:u} && answer != ""',
    "",
    1,
    0,
    { e: examId, u: userId }
  );
  return !!(rows && rows.length > 0);
}

/** Id владельца (организатора) экзамена, либо "". */
function examOwnerId(app, examId) {
  if (!examId) return "";
  try {
    const exam = app.findRecordById("exams", examId);
    return exam ? String(exam.get("owner") || "") : "";
  } catch (e) {
    return "";
  }
}

module.exports = { passedProofOfKnowledge, examOwnerId };
