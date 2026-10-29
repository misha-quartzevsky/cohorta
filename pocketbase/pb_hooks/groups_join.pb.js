/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  groups_join.pb.js — серверные маршруты для вступления в
//  группу и ростера, взамен прямых запросов к `groups`/`users`
//  после ужесточения их правил (миграция
//  1790001100_close_group_access_holes.js, A0.5 разведки
//  2026-10-18). Все маршруты требуют входа.
//
//  POST /api/groups/join    {code}     → вступить по invite_code (закрытая ссылка не пускает)
//  GET  /api/groups/preview ?code=     → название, число участников и создатель группы по коду (экран подтверждения)
//  GET  /api/groups/{id}/roster        → ростер группы (участник/владелец)
//
//  Поиска групп по названию нет (маршрут GET /api/groups/search удалён в волне 1 аудита безопасности, B-5:
//  он перечислял названия всех групп; вступление только по коду). join и preview ограничены по частоте
//  (B-7), чтобы код нельзя было подбирать. Ростер отдаёт только поля, нужные экрану «Группа»
//  (id/name участника, avatar) — не invite_code, не весь профиль пользователя и не почта.
// ============================================================

routerAdd(
  "POST",
  "/api/groups/join",
  (e) => {
    const data = new DynamicModel({ code: "" });
    e.bindBody(data);

    const g = require(`${__hooks}/lib_groups.js`);
    g.rateLimit(e.app, `join:${e.auth.id}`, 20, 600);
    const code = g.normalizeCode(data.code);
    if (!code) {
      throw new BadRequestError("Введите код приглашения.");
    }

    let group;
    try {
      group = e.app.findFirstRecordByFilter("groups", "invite_code = {:code}", {
        code: code,
      });
    } catch (err) {
      throw new NotFoundError("Группа с таким кодом не найдена.");
    }

    let restorable = 0;
    if (!g.isMember(e.app, group.id, e.auth.id)) {
      // Закрытая ссылка не раскрывает, что группа существует.
      if (group.get("invite_enabled") !== true) {
        throw new NotFoundError("Группа с таким кодом не найдена.");
      }
      const collection = e.app.findCollectionByNameOrId("group_members");
      const record = new Record(collection);
      record.set("group", group.id);
      record.set("user", e.auth.id);
      e.app.save(record);
      restorable = g.onRejoin(e.app, group.id, e.auth.id);
    }

    return e.json(200, {
      id: group.id,
      name: group.get("name"),
      slug: group.get("slug"),
      restorable: restorable,
    });
  },
  $apis.requireAuth()
);

// Предпросмотр группы по коду — для экрана подтверждения вступления
// (ссылка cohorta.ru/join/КОД). Отдаёт только название, число участников
// и имя того, кто создал группу; ни код, ни список людей не раскрывает.
routerAdd(
  "GET",
  "/api/groups/preview",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    g.rateLimit(e.app, `preview:${e.auth.id}`, 40, 600);
    const code = g.normalizeCode(e.request.url.query().get("code"));
    if (!code) {
      throw new BadRequestError("Введите код приглашения.");
    }
    let group;
    try {
      group = e.app.findFirstRecordByFilter("groups", "invite_code = {:code}", { code: code });
    } catch (err) {
      throw new NotFoundError("Группа с таким кодом не найдена.");
    }
    if (group.get("invite_enabled") !== true) {
      throw new NotFoundError("Группа с таким кодом не найдена.");
    }
    let members = 0;
    try {
      members = e.app.countRecords("group_members", $dbx.hashExp({ group: group.id }));
    } catch (err) {
      members = 0;
    }
    let ownerName = "";
    try {
      const owner = e.app.findRecordById("users", group.get("owner"));
      ownerName = g.userLabel(owner);
    } catch (err) {
      ownerName = "";
    }
    let isMember = false;
    try {
      e.app.findFirstRecordByFilter("group_members", "group = {:g} && user = {:u}", { g: group.id, u: e.auth.id });
      isMember = true;
    } catch (err) {
      isMember = false;
    }
    return e.json(200, {
      id: group.id,
      name: group.get("name"),
      members: members,
      owner_name: ownerName,
      is_member: isMember,
    });
  },
  $apis.requireAuth()
);

routerAdd(
  "GET",
  "/api/groups/{id}/roster",
  (e) => {
    const db = require(`${__hooks}/lib_db.js`);
    const g = require(`${__hooks}/lib_groups.js`);
    const groupId = e.request.pathValue("id");

    const group = db.getOr404(e.app, "groups", groupId, "Группа не найдена.");

    const isOwner = group.get("owner") === e.auth.id;
    let myMembership = null;
    if (!isOwner) {
      try {
        myMembership = e.app.findFirstRecordByFilter(
          "group_members",
          "group = {:g} && user = {:u}",
          { g: groupId, u: e.auth.id }
        );
      } catch (err) {
        myMembership = null;
      }
      if (!myMembership) {
        throw new ForbiddenError("Нет доступа к этой группе.");
      }
    }

    const members = e.app.findRecordsByFilter(
      "group_members",
      "group = {:g}",
      "joined_at",
      500,
      0,
      { g: groupId }
    );

    const out = members.map((m) => {
      let user = null;
      try {
        const u = e.app.findRecordById("users", m.get("user"));
        // Почту одногруппникам не отдаём: для подписи нужно имя (если его нет —
        // часть почты до «@»), и аватар.
        const label = g.userLabel(u);
        user = { id: u.id, name: label, avatar: String(u.get("avatar") || "") };
      } catch (err) {
        user = null;
      }
      return {
        id: m.id,
        user: user,
        joined_at: m.get("joined_at"),
        preview_enabled: !!m.get("preview_enabled"),
      };
    });

    return e.json(200, out);
  },
  $apis.requireAuth()
);
