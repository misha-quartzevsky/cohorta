/// <reference path="../pb_data/types.d.ts" />

// Хелперы группы (JSVM изолирует scope обработчиков — подключаются через
// require(`${__hooks}/lib_groups.js`) внутри обработчика).

function nowStr() {
  return new Date().toISOString().replace("T", " ");
}

function inSeconds(n) {
  return new Date(Date.now() + n * 1000).toISOString().replace("T", " ");
}

/** Название предмета для сравнения: без регистра и пробелов. */
function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "");
}

function first(app, collection, filter, params) {
  const rows = app.findRecordsByFilter(collection, filter, "", 1, 0, params || {});
  return rows && rows[0] ? rows[0] : null;
}

function all(app, collection, filter, params) {
  return app.findRecordsByFilter(collection, filter, "", 5000, 0, params || {}) || [];
}

/** Состоит ли пользователь в группе (владелец тоже имеет строку членства). */
function isMember(app, groupId, userId) {
  if (!groupId || !userId) return false;
  return !!first(app, "group_members", "group = {:g} && user = {:u}", { g: groupId, u: userId });
}

/** Id первой общей группы двух людей или "" (нет общей группы). */
function shareGroupId(app, userA, userB) {
  if (!userA || !userB || userA === userB) return "";
  for (const m of all(app, "group_members", "user = {:u}", { u: userA })) {
    const gid = String(m.get("group"));
    if (isMember(app, gid, userB)) return gid;
  }
  return "";
}

/**
 * Группа из пути маршрута, только для владельца. Не участнику группа не
 * раскрывается (404), участнику-не-владельцу — 403.
 */
function ownerOnlyGroup(e) {
  const groupId = e.request.pathValue("id");
  let group;
  try {
    group = e.app.findRecordById("groups", groupId);
  } catch (err) {
    throw new NotFoundError("Группа не найдена.");
  }
  if (group.get("owner") === e.auth.id) return group;
  if (!isMember(e.app, group.id, e.auth.id)) throw new NotFoundError("Группа не найдена.");
  throw new ForbiddenError("Это может только владелец группы.");
}

/** Подгруппа из пути, только для её участника; постороннему — 404 (существование не раскрывается). */
function memberSubgroup(e, paramName) {
  const id = e.request.pathValue(paramName || "id");
  let sub;
  try {
    sub = e.app.findRecordById("exam_subgroups", id);
  } catch (err) {
    throw new NotFoundError("Не найдено.");
  }
  if (!first(e.app, "exam_participants", "subgroup = {:s} && user = {:u}", { s: sub.id, u: e.auth.id })) {
    throw new NotFoundError("Не найдено.");
  }
  return sub;
}

/** Группа экзамена по подгруппе. */
function subgroupGroupId(app, sub) {
  const exam = app.findRecordById("exams", String(sub.get("exam")));
  return String(exam.get("group") || "");
}

/** Доступ подгруппе: создать доступы на все лекции, открытые подгруппе, для нового участника. */
function grantSubgroupShares(app, sub, userId) {
  const rows = all(app, "lecture_shares", "subgroup = {:s}", { s: sub.id });
  const seen = {};
  const col = app.findCollectionByNameOrId("lecture_shares");
  for (const r of rows) {
    const lecture = String(r.get("lecture"));
    if (seen[lecture]) continue;
    seen[lecture] = true;
    if (String(r.get("owner")) === userId) continue;
    if (first(app, "lecture_shares", "lecture = {:l} && grantee = {:u} && subgroup = {:s}", { l: lecture, u: userId, s: sub.id })) continue;
    const rec = new Record(col);
    rec.set("lecture", lecture);
    rec.set("owner", r.get("owner"));
    rec.set("grantee", userId);
    rec.set("group", r.get("group"));
    rec.set("subgroup", sub.id);
    rec.set("allow_copy", !!r.get("allow_copy"));
    rec.set("suspended", false);
    app.save(rec);
  }
}

/** Человек выходит из подгруппы: участие, доступы подгруппе, блокировки, пустая подгруппа. */
function removeFromSubgroup(app, sub, userId) {
  const part = first(app, "exam_participants", "subgroup = {:s} && user = {:u}", { s: sub.id, u: userId });
  if (part) app.delete(part);
  for (const sh of all(app, "lecture_shares", "grantee = {:u} && subgroup = {:s}", { u: userId, s: sub.id })) app.delete(sh);
  for (const t of all(app, "exam_tickets", "subgroup = {:s} && locked_by = {:u}", { s: sub.id, u: userId })) {
    t.set("locked_by", "");
    t.set("locked_until", "");
    app.save(t);
  }
  for (const t of all(app, "exam_tickets", "subgroup = {:s} && assignees ~ {:u}", { s: sub.id, u: userId })) {
    t.set("assignees", (t.get("assignees") || []).filter((x) => x !== userId));
    app.save(t);
  }
  if (app.countRecords("exam_participants", $dbx.hashExp({ subgroup: sub.id })) === 0) {
    app.delete(sub);
  }
}

/**
 * Выход или исключение из группы (в транзакции).
 *  remember — оставить выданные мной доступы приостановленными (иначе удалить);
 *  kicked   — исключение: доступы в обе стороны удаляются.
 */
function leaveGroupCore(app, group, userId, opts) {
  const remember = !!(opts && opts.remember);
  const kicked = !!(opts && opts.kicked);
  app.runInTransaction((tx) => {
    const g = group.id;
    // доступы, выданные мной в этой группе
    for (const sh of all(tx, "lecture_shares", "owner = {:u} && group = {:g}", { u: userId, g: g })) {
      if (kicked || !remember || String(sh.get("subgroup") || "") !== "") tx.delete(sh);
      else {
        sh.set("suspended", true);
        tx.save(sh);
      }
    }
    // доступы, выданные мне: сохраняются приостановленными (подгруппам и при исключении — удаляются)
    for (const sh of all(tx, "lecture_shares", "grantee = {:u} && group = {:g}", { u: userId, g: g })) {
      if (kicked || String(sh.get("subgroup") || "") !== "") tx.delete(sh);
      else {
        sh.set("suspended", true);
        tx.save(sh);
      }
    }
    // подгруппы экзаменов этой группы
    for (const p of all(tx, "exam_participants", "user = {:u} && exam.group = {:g} && subgroup != ''", { u: userId, g: g })) {
      let sub = null;
      try {
        sub = tx.findRecordById("exam_subgroups", String(p.get("subgroup")));
      } catch (err) {
        sub = null;
      }
      if (sub) removeFromSubgroup(tx, sub, userId);
    }
    for (const pv of all(tx, "lecture_previews", "owner = {:u} && group = {:g}", { u: userId, g: g })) tx.delete(pv);
    for (const rq of all(tx, "access_requests", "(requester = {:u} || owner = {:u}) && group = {:g}", { u: userId, g: g })) tx.delete(rq);
    const m = first(tx, "group_members", "group = {:g} && user = {:u}", { g: g, u: userId });
    if (m) tx.delete(m);
  });
}

/** Вернувшийся в группу: полученные доступы включаются сами, считаем «выданные мной» для возврата. */
function onRejoin(app, groupId, userId) {
  for (const sh of all(app, "lecture_shares", "grantee = {:u} && group = {:g} && suspended = true", { u: userId, g: groupId })) {
    if (isMember(app, groupId, String(sh.get("owner")))) {
      sh.set("suspended", false);
      app.save(sh);
    }
  }
  return restorableCount(app, groupId, userId);
}

function restorableShares(app, groupId, userId) {
  return all(app, "lecture_shares", "owner = {:u} && group = {:g} && suspended = true && subgroup = ''", { u: userId, g: groupId }).filter((sh) =>
    isMember(app, groupId, String(sh.get("grantee")))
  );
}

function restorableCount(app, groupId, userId) {
  return restorableShares(app, groupId, userId).length;
}

module.exports = {
  nowStr,
  inSeconds,
  norm,
  first,
  all,
  isMember,
  shareGroupId,
  ownerOnlyGroup,
  memberSubgroup,
  subgroupGroupId,
  grantSubgroupShares,
  removeFromSubgroup,
  leaveGroupCore,
  onRejoin,
  restorableShares,
  restorableCount,
};
