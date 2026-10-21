/// <reference path="../pb_data/types.d.ts" />

// Хелперы для groups_manage.pb.js (JSVM изолирует scope обработчиков —
// общие функции подключаются через require внутри обработчика).

/** Состоит ли пользователь в группе (владелец тоже имеет строку членства). */
function isMember(app, groupId, userId) {
  if (!groupId || !userId) return false;
  const rows = app.findRecordsByFilter(
    "group_members",
    "group = {:g} && user = {:u}",
    "",
    1,
    0,
    { g: groupId, u: userId }
  );
  return !!(rows && rows[0]);
}

/** Id первой общей группы двух людей или "" (нет общей группы). */
function shareGroupId(app, userA, userB) {
  if (!userA || !userB || userA === userB) return "";
  const mine = app.findRecordsByFilter("group_members", "user = {:u}", "", 500, 0, { u: userA });
  for (const m of mine) {
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

module.exports = { isMember, shareGroupId, ownerOnlyGroup };
