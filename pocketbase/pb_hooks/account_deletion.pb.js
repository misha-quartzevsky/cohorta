/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  account_deletion.pb.js — удаление аккаунта через 14 дней (B6).
//
//  POST /api/account/delete-request   → создать запрос (scheduled_for = +14 дней)
//  POST /api/account/delete-cancel    → отменить открытый запрос
//
//  Владелец группы, в которой есть другие участники, сначала передаёт её
//  (ответ 409, code "group_owner"). Раз в сутки задача стирает аккаунты,
//  у которых срок вышел: сначала данные, которые не удаляются каскадом,
//  потом сам пользователь (остальное уходит каскадом).
// ============================================================

routerAdd(
  "POST",
  "/api/account/delete-request",
  (e) => {
    const uid = e.auth.id;

    // Передай группу: владелец, у которого в группе есть кто-то ещё.
    let owned = [];
    try {
      owned = e.app.findRecordsByFilter("groups", "owner = {:u}", "", 50, 0, { u: uid });
    } catch (err) {
      owned = [];
    }
    for (const g of owned) {
      let others = 0;
      try {
        others = e.app.countRecords("group_members", $dbx.exp("`group` = {:g} AND user != {:u}", { g: g.id, u: uid }));
      } catch (err) {
        others = 0;
      }
      if (others > 0) {
        return e.json(409, { code: "group_owner", group_name: String(g.get("name") || "") });
      }
    }

    let existing = null;
    try {
      existing = e.app.findFirstRecordByFilter("deletion_requests", 'user = {:u} && status = "new"', { u: uid });
    } catch (err) {
      existing = null;
    }
    if (existing) {
      return e.json(200, { scheduled_for: String(existing.get("scheduled_for")) });
    }

    const when = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().replace("T", " ");
    const col = e.app.findCollectionByNameOrId("deletion_requests");
    const rec = new Record(col);
    rec.set("user", uid);
    rec.set("email", String(e.auth.get("email") || ""));
    rec.set("status", "new");
    rec.set("scheduled_for", when);
    e.app.save(rec);
    return e.json(200, { scheduled_for: when });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/account/delete-cancel",
  (e) => {
    const rows = e.app.findRecordsByFilter("deletion_requests", 'user = {:u} && status = "new"', "", 20, 0, { u: e.auth.id });
    for (const r of rows) {
      r.set("status", "cancelled");
      e.app.save(r);
    }
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

cronAdd("account_deletion", "30 3 * * *", () => {
  const nowStr = new Date().toISOString().replace("T", " ");
  let due = [];
  try {
    due = $app.findRecordsByFilter("deletion_requests", 'status = "new" && scheduled_for != "" && scheduled_for < {:n}', "", 100, 0, { n: nowStr });
  } catch (err) {
    due = [];
  }
  for (const req of due) {
    const uid = String(req.get("user"));
    try {
      const wipe = (collection, field) => {
        const rows = $app.findRecordsByFilter(collection, `${field} = {:u}`, "", 10000, 0, { u: uid });
        for (const r of rows) $app.delete(r);
      };
      wipe("lecture_previews", "owner");
      wipe("lectures", "owner");
      wipe("courses", "owner");
      wipe("semesters", "user");
      wipe("decks", "owner");
      const tickets = $app.findRecordsByFilter("exam_tickets", "author = {:u}", "", 10000, 0, { u: uid });
      for (const t of tickets) {
        t.set("author", "");
        $app.save(t);
      }
      const grants = $app.findRecordsByFilter("premium_grants", "related_user = {:u}", "", 1000, 0, { u: uid });
      for (const g of grants) {
        g.set("related_user", "");
        $app.save(g);
      }
      $app.delete($app.findRecordById("users", uid));
    } catch (err) {
      console.log("[account_deletion] failed for", uid, err);
    }
  }
});
