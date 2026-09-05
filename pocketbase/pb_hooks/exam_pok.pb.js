/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  exam_pok.pb.js — Proof-of-Knowledge для чужих ответов.
//
//  API-rule даёт участнику коллективного экзамена ЧИТАТЬ билеты
//  (вопросы). Ответы (`answer`, `attachments`) — отдельный слой:
//  участник видит чужой ответ только после того, как сам заполнил
//  ответ хотя бы на один свой назначенный билет в этом экзамене.
//
//  Реализация — onRecordEnrich: вырезаем `answer`/`attachments`
//  из ОТДАВАЕМОЙ записи (не из БД), если запрашивающий — не
//  организатор и PoK не пройден.
//
//  Пока UI назначения билетов участникам не сделан, `author` у
//  билетов не проставлен → участники всегда видят только вопросы.
//  Это осознанный консервативный дефолт фундамента.
//
//  При ошибке хука — fail-open (не режем): API-rule уже
//  ограничил доступ к билету организатором + участниками, PoK
//  здесь — дополнительный слой, и ронять весь Exam Engine из-за
//  сбоя enrich нельзя.
// ============================================================

onRecordEnrich((e) => {
  try {
    const auth = e.requestInfo && e.requestInfo.auth;
    const uid = auth ? String(auth.id || "") : "";
    if (uid) {
      const lib = require(`${__hooks}/lib_exam.js`);
      const examId = String(e.record.get("exam") || "");
      const ownerId = lib.examOwnerId(e.app, examId);

      if (uid !== ownerId && !lib.passedProofOfKnowledge(e.app, examId, uid)) {
        e.record.set("answer", "");
        e.record.set("attachments", []);
      }
    }
  } catch (err) {
    console.log("[exam_pok] enrich failed (fail-open):", err);
  }
  e.next();
}, "exam_tickets");
