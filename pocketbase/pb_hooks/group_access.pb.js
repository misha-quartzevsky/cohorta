/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  group_access.pb.js — волна C: доступ к лекциям в группе.
//
//  POST   /api/lectures/{id}/share-subgroup        {subgroup, allow_copy}  доступ подгруппе (автор — её участник)
//  DELETE /api/lectures/{id}/share-subgroup/{sub}                           снять доступ подгруппе
//  POST   /api/lectures/{id}/request-access                                 запрос доступа к закрытой лекции
//  POST   /api/access-requests/{id}/resolve        {action, allow_copy}    автор: grant | decline
//  POST   /api/lectures/{id}/copy                  {course}                 «Добавить в мои конспекты»
//  GET    /api/group/notifications?since=                                  данные для точки и сообщения
//
//  Чужой лекции не раскрывается ничего сверх разрешённого: запросить доступ
//  можно только к лекции, название которой тебе уже видно (включён предпросмотр).
// ============================================================

routerAdd(
  "POST",
  "/api/lectures/{id}/share-subgroup",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const lecture = (() => {
      try {
        return e.app.findRecordById("lectures", e.request.pathValue("id"));
      } catch (err) {
        throw new NotFoundError("Лекция не найдена.");
      }
    })();
    if (lecture.get("owner") !== e.auth.id || String(lecture.get("deleted_at") || "") !== "") {
      throw new NotFoundError("Лекция не найдена.");
    }
    const data = new DynamicModel({ subgroup: "", allow_copy: false });
    e.bindBody(data);
    let sub;
    try {
      sub = e.app.findRecordById("exam_subgroups", String(data.subgroup));
    } catch (err) {
      throw new NotFoundError("Подгруппа не найдена.");
    }
    if (!g.first(e.app, "exam_participants", "subgroup = {:s} && user = {:u}", { s: sub.id, u: e.auth.id })) {
      throw new NotFoundError("Подгруппа не найдена.");
    }
    const groupId = g.subgroupGroupId(e.app, sub);
    const col = e.app.findCollectionByNameOrId("lecture_shares");
    let n = 0;
    for (const p of g.all(e.app, "exam_participants", "subgroup = {:s}", { s: sub.id })) {
      const uid = String(p.get("user"));
      if (uid === e.auth.id || !g.isMember(e.app, groupId, uid)) continue;
      const have = g.first(e.app, "lecture_shares", "lecture = {:l} && grantee = {:u} && subgroup = {:s}", { l: lecture.id, u: uid, s: sub.id });
      if (have) {
        have.set("allow_copy", !!data.allow_copy);
        e.app.save(have);
        continue;
      }
      const rec = new Record(col);
      rec.set("lecture", lecture.id);
      rec.set("owner", e.auth.id);
      rec.set("grantee", uid);
      rec.set("group", groupId);
      rec.set("subgroup", sub.id);
      rec.set("allow_copy", !!data.allow_copy);
      rec.set("suspended", false);
      e.app.save(rec);
      n += 1;
    }
    // Если в подгруппе только автор, доступ некому выдавать — но «строка подгруппы»
    // тоже должна существовать: ставим маркер-доступ самому себе нельзя, поэтому
    // возвращаем число новых доступов.
    return e.json(200, { granted: n });
  },
  $apis.requireAuth()
);

routerAdd(
  "DELETE",
  "/api/lectures/{id}/share-subgroup/{sub}",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const rows = g.all(e.app, "lecture_shares", "lecture = {:l} && owner = {:u} && subgroup = {:s}", {
      l: e.request.pathValue("id"),
      u: e.auth.id,
      s: e.request.pathValue("sub"),
    });
    for (const r of rows) e.app.delete(r);
    return e.json(200, { removed: rows.length });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/lectures/{id}/request-access",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const me = e.auth.id;
    let lecture;
    try {
      lecture = e.app.findRecordById("lectures", e.request.pathValue("id"));
    } catch (err) {
      throw new NotFoundError("Лекция не найдена.");
    }
    const owner = String(lecture.get("owner") || "");
    // Название видно в той группе, где автор включил предпросмотр и ты состоишь.
    const preview = g.all(e.app, "lecture_previews", "lecture = {:l}", { l: lecture.id }).find((p) => g.isMember(e.app, String(p.get("group")), me)) || null;
    // Запросить можно только то, что тебе видно по названию: общая группа и включённый предпросмотр.
    if (!owner || owner === me || String(lecture.get("deleted_at") || "") !== "" || !preview) {
      throw new NotFoundError("Лекция не найдена.");
    }
    const groupId = String(preview.get("group"));
    if (!g.isMember(e.app, groupId, me) || !g.isMember(e.app, groupId, owner)) {
      throw new NotFoundError("Лекция не найдена.");
    }
    const active = g.first(e.app, "lecture_shares", "lecture = {:l} && grantee = {:u} && suspended != true", { l: lecture.id, u: me });
    if (active) return e.json(409, { code: "already_shared" });
    const open = g.first(e.app, "access_requests", "lecture = {:l} && requester = {:u} && status = 'open'", { l: lecture.id, u: me });
    if (open) return e.json(200, { id: open.id, status: "open" });
    const col = e.app.findCollectionByNameOrId("access_requests");
    const rec = new Record(col);
    rec.set("lecture", lecture.id);
    rec.set("requester", me);
    rec.set("owner", owner);
    rec.set("group", groupId);
    rec.set("status", "open");
    e.app.save(rec);
    return e.json(200, { id: rec.id, status: "open" });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/access-requests/{id}/resolve",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    let req;
    try {
      req = e.app.findRecordById("access_requests", e.request.pathValue("id"));
    } catch (err) {
      throw new NotFoundError("Запрос не найден.");
    }
    if (req.get("owner") !== e.auth.id) throw new NotFoundError("Запрос не найден.");
    if (req.get("status") !== "open") return e.json(409, { code: "not_open" });
    const data = new DynamicModel({ action: "", allow_copy: false });
    e.bindBody(data);
    if (data.action === "decline") {
      req.set("status", "declined");
      e.app.save(req);
      return e.json(200, { status: "declined" });
    }
    if (data.action !== "grant") throw new BadRequestError("Неизвестное действие.");
    const requester = String(req.get("requester"));
    const groupId = String(req.get("group"));
    const lectureId = String(req.get("lecture"));
    if (!g.isMember(e.app, groupId, requester) || !g.isMember(e.app, groupId, e.auth.id)) {
      return e.json(409, { code: "not_in_group" });
    }
    const have = g.first(e.app, "lecture_shares", "lecture = {:l} && grantee = {:u} && group = {:g} && subgroup = ''", {
      l: lectureId,
      u: requester,
      g: groupId,
    });
    if (have) {
      have.set("suspended", false);
      have.set("allow_copy", !!data.allow_copy);
      e.app.save(have);
    } else {
      const rec = new Record(e.app.findCollectionByNameOrId("lecture_shares"));
      rec.set("lecture", lectureId);
      rec.set("owner", e.auth.id);
      rec.set("grantee", requester);
      rec.set("group", groupId);
      rec.set("allow_copy", !!data.allow_copy);
      rec.set("suspended", false);
      e.app.save(rec);
    }
    req.set("status", "granted");
    e.app.save(req);
    return e.json(200, { status: "granted" });
  },
  $apis.requireAuth()
);

// «Добавить в мои конспекты»: только если автор разрешил копирование этому человеку.
routerAdd(
  "POST",
  "/api/lectures/{id}/copy",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const me = e.auth.id;
    let lecture;
    try {
      lecture = e.app.findRecordById("lectures", e.request.pathValue("id"));
    } catch (err) {
      throw new NotFoundError("Лекция не найдена.");
    }
    if (String(lecture.get("deleted_at") || "") !== "") throw new NotFoundError("Лекция не найдена.");
    const shares = g.all(e.app, "lecture_shares", "lecture = {:l} && grantee = {:u} && suspended != true", { l: lecture.id, u: me });
    if (shares.length === 0) throw new NotFoundError("Лекция не найдена.");
    if (!shares.some((s) => s.get("allow_copy") === true)) {
      throw new ForbiddenError("Автор не разрешил копировать эту лекцию.");
    }
    const data = new DynamicModel({ course: "" });
    e.bindBody(data);
    const course = String(data.course || "");
    if (course) {
      let c = null;
      try {
        c = e.app.findRecordById("courses", course);
      } catch (err) {
        c = null;
      }
      if (!c || c.get("owner") !== me) throw new BadRequestError("Предмет не найден.");
    }
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const copy = new Record(e.app.findCollectionByNameOrId("lectures"));
    copy.set("title", String(lecture.get("title") || ""));
    copy.set("content", String(lecture.get("content") || ""));
    copy.set("owner", me);
    copy.set("slug", "copy-" + $security.randomStringWithAlphabet(10, alphabet));
    if (course) copy.set("field", course);
    e.app.save(copy);
    return e.json(200, { id: copy.id, slug: copy.get("slug") });
  },
  $apis.requireAuth()
);

// Данные для точки на «Группа», сообщения и значка «Новое»: что случилось после `since`.
routerAdd(
  "GET",
  "/api/group/notifications",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const me = e.auth.id;
    let since = String(e.request.url.query().get("since") || "").trim();
    if (!since) since = "1970-01-01 00:00:00.000Z";
    since = since.replace("T", " ");
    const name = (uid) => {
      try {
        const u = e.app.findRecordById("users", uid);
        const n = String(u.get("name") || "").trim();
        return n || String(u.get("email") || "").split("@")[0];
      } catch (err) {
        return "";
      }
    };
    const title = (lid) => {
      try {
        return String(e.app.findRecordById("lectures", lid).get("title") || "");
      } catch (err) {
        return "";
      }
    };
    const requests = g
      .all(e.app, "access_requests", "owner = {:u} && status = 'open' && created > {:s}", { u: me, s: since })
      .map((r) => ({
        id: r.id,
        lecture: String(r.get("lecture")),
        lecture_title: title(String(r.get("lecture"))),
        requester: String(r.get("requester")),
        requester_name: name(String(r.get("requester"))),
        group: String(r.get("group")),
        created: String(r.get("created")),
      }));
    const shares = g
      .all(e.app, "lecture_shares", "grantee = {:u} && suspended != true && created > {:s}", { u: me, s: since })
      .map((r) => ({
        id: r.id,
        lecture: String(r.get("lecture")),
        lecture_title: title(String(r.get("lecture"))),
        owner: String(r.get("owner")),
        owner_name: name(String(r.get("owner"))),
        created: String(r.get("created")),
      }));
    const subgroups = g
      .all(e.app, "exam_participants", "user = {:u} && subgroup != '' && updated > {:s}", { u: me, s: since })
      .map((r) => {
        let n = "";
        try {
          n = String(e.app.findRecordById("exam_subgroups", String(r.get("subgroup"))).get("name") || "");
        } catch (err) {
          n = "";
        }
        return { subgroup: String(r.get("subgroup")), name: n, created: String(r.get("updated")) };
      });
    return e.json(200, {
      requests: requests,
      shares: shares,
      subgroups: subgroups,
      has_new: requests.length + shares.length + subgroups.length > 0,
    });
  },
  $apis.requireAuth()
);
