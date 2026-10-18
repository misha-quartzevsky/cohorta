/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  groups_access.pb.js — серверные маршруты для вступления в
//  группу и ростера, взамен прямых запросов к `groups`/`users`
//  после ужесточения их правил (миграция
//  1790001100_close_group_access_holes.js, A0.5 разведки
//  2026-10-18). Все три маршрута требуют входа.
//
//  POST /api/groups/join   {code}      → вступить по invite_code
//  GET  /api/groups/search ?q=         → нечёткий поиск групп по названию
//  GET  /api/groups/:id/roster         → ростер группы (участник/владелец)
//
//  Поиск и ростер отдают только поля, нужные экрану «Группа»
//  (name/id/slug; name/email участника) — не invite_code, не
//  весь профиль пользователя.
// ============================================================

routerAdd(
  "POST",
  "/api/groups/join",
  (e) => {
    const data = new DynamicModel({ code: "" });
    e.bindBody(data);

    const code = String(data.code || "").trim().toLowerCase();
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

    let membership = null;
    try {
      membership = e.app.findFirstRecordByFilter(
        "group_members",
        "group = {:g} && user = {:u}",
        { g: group.id, u: e.auth.id }
      );
    } catch (err) {
      membership = null;
    }

    if (!membership) {
      const collection = e.app.findCollectionByNameOrId("group_members");
      const record = new Record(collection);
      record.set("group", group.id);
      record.set("user", e.auth.id);
      e.app.save(record);
    }

    return e.json(200, {
      id: group.id,
      name: group.get("name"),
      slug: group.get("slug"),
    });
  },
  $apis.requireAuth()
);

routerAdd(
  "GET",
  "/api/groups/search",
  (e) => {
    // JSVM изолирует scope обработчиков — хелперы объявляем внутри.
    const TRANSLIT = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
      з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
      п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
      ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    };
    function normalizeGroupName(text) {
      const lower = String(text || "").trim().toLowerCase();
      let out = "";
      for (const ch of lower) {
        out += TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch;
      }
      return out.replace(/[^a-z0-9]+/g, "");
    }

    const q = (e.request.url.query().get("q") || "").trim();
    if (q.length < 2) {
      return e.json(200, []);
    }

    const found = new Map();
    const limit = 6;

    try {
      const contains = e.app.findRecordsByFilter(
        "groups",
        "name ~ {:q}",
        "name",
        limit,
        0,
        { q: q }
      );
      for (const g of contains) found.set(g.id, g);
    } catch (err) {
      /* ignore — пробуем нормализованное сравнение ниже */
    }

    const norm = normalizeGroupName(q);
    if (found.size < limit && norm.length >= 2) {
      try {
        const all = e.app.findRecordsByFilter("groups", "", "name", 500, 0, {});
        for (const g of all) {
          if (found.size >= limit + 20) break;
          const gn = normalizeGroupName(g.get("name"));
          if (gn.indexOf(norm) >= 0 || norm.indexOf(gn) >= 0) found.set(g.id, g);
        }
      } catch (err) {
        /* оставляем то, что нашли ~-фильтром */
      }
    }

    const out = [];
    for (const g of found.values()) {
      if (out.length >= limit) break;
      out.push({ id: g.id, name: g.get("name") });
    }
    return e.json(200, out);
  },
  $apis.requireAuth()
);

routerAdd(
  "GET",
  "/api/groups/{id}/roster",
  (e) => {
    const groupId = e.request.pathValue("id");

    let group;
    try {
      group = e.app.findRecordById("groups", groupId);
    } catch (err) {
      throw new NotFoundError("Группа не найдена.");
    }

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
        user = { id: u.id, name: u.get("name"), email: u.get("email") };
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
