/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lib_db.js — общие помощники работы с базой и временем для хуков.
//
//  JSVM изолирует scope обработчиков: подключается через
//  require(`${__hooks}/lib_db.js`) внутри обработчика. lib_groups.js
//  реэкспортирует first, all, nowStr и inSeconds, так что прежние
//  вызовы g.first / g.all / g.nowStr продолжают работать.
// ============================================================

/** Момент времени в формате PocketBase: «2026-10-26 12:00:00.000Z» (пробел вместо T). */
function pbTime(date) {
  return date.toISOString().replace("T", " ");
}

function nowStr() {
  return pbTime(new Date());
}

function inSeconds(n) {
  return pbTime(new Date(Date.now() + n * 1000));
}

/** Момент через `n` суток от сейчас (отрицательное n — в прошлом). */
function daysFromNow(n) {
  return pbTime(new Date(Date.now() + n * 24 * 3600 * 1000));
}

function first(app, collection, filter, params) {
  const rows = app.findRecordsByFilter(collection, filter, "", 1, 0, params || {});
  return rows && rows[0] ? rows[0] : null;
}

function all(app, collection, filter, params) {
  return app.findRecordsByFilter(collection, filter, "", 5000, 0, params || {}) || [];
}

/** Запись по id; любая ошибка поиска превращается в 404 с заданным текстом. */
function getOr404(app, collection, id, message) {
  try {
    return app.findRecordById(collection, id);
  } catch (err) {
    throw new NotFoundError(message);
  }
}

module.exports = { pbTime, nowStr, inSeconds, daysFromNow, first, all, getOr404 };
