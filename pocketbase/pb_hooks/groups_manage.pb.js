/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  groups_manage.pb.js — волна C, этап 1 (21.10.2026).
//
//  Группы и членство меняются только отсюда: правила коллекций
//  `groups` и `group_members` закрывают create/delete для клиента
//  (миграция 1790009000_group_access_rules.js).
//
//  POST /api/groups/new-code                     → свежий случайный код для формы «Новая группа» (с лимитом частоты)
//  POST /api/groups/create               {name, code?} → создать группу (владелец — я); код из формы, если свободен, иначе новый
//  GET  /api/groups/{id}/invite                  → код приглашения (только владелец)
//  POST /api/groups/{id}/invite/reset            → новый код, участники остаются (только владелец)
//  POST /api/groups/{id}/invite/enable   {enabled} → открыть или закрыть ссылку-приглашение (только владелец)
//  POST /api/groups/{id}/transfer        {user}  → передать группу участнику (только владелец)
//  POST /api/groups/{id}/leave           {remember?} → выйти (владелец с другими участниками сначала передаёт группу)
//  POST /api/groups/{id}/kick            {user}  → исключить участника (только владелец)
//  POST /api/groups/{id}/restore-access          → вернуть приостановленные выданные мной доступы
//  GET  /api/groups/{id}/restorable              → сколько доступов можно вернуть
//
//  + хук на lecture_shares: доступ можно выдать только тому, кто
//  состоит с автором в одной группе.
//
//  Постороннему (не участнику) группа не раскрывается: 404, а не 403.
// ============================================================

// Новый код приглашения для формы «Новая группа»: случайный, свободный на этот момент. Ничего не резервирует и
// ничего не раскрывает (только свежий код; чужих кодов нет, «занят ли такой» не спросить), частота ограничена.
routerAdd(
  "POST",
  "/api/groups/new-code",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    g.rateLimit(e.app, `newcode:${e.auth.id}`, 20, 600);
    return e.json(200, { code: g.newInviteCode(e.app) });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/groups/create",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    g.rateLimit(e.app, `create:${e.auth.id}`, 10, 600);
    const data = new DynamicModel({ name: "", code: "" });
    e.bindBody(data);
    const name = String(data.name || "").trim();
    if (!name) throw new BadRequestError("Введите название группы.");
    if (name.length > 80) throw new BadRequestError("Название слишком длинное.");

    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const slugBase =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "group";

    let result = null;
    e.app.runInTransaction((tx) => {
      // Код из формы, если он годится и до сих пор свободен; иначе сервер подбирает новый и возвращает его (не падает).
      let code = g.normalizeCode(data.code);
      const okFormat = code.length === 8 && code.split("").every((ch) => g.CODE_ALPHABET.indexOf(ch) >= 0);
      if (!okFormat || g.codeTaken(tx, code)) code = g.newInviteCode(tx);

      const groups = tx.findCollectionByNameOrId("groups");
      const group = new Record(groups);
      group.set("name", name);
      group.set("slug", slugBase + "-" + $security.randomStringWithAlphabet(4, alphabet));
      group.set("owner", e.auth.id);
      group.set("invite_code", code);
      group.set("invite_enabled", false); // по умолчанию ссылка закрыта
      tx.save(group);

      const members = tx.findCollectionByNameOrId("group_members");
      const member = new Record(members);
      member.set("group", group.id);
      member.set("user", e.auth.id);
      tx.save(member);
      result = { id: group.id, name: group.get("name"), slug: group.get("slug"), code: code };
    });
    return e.json(200, result);
  },
  $apis.requireAuth()
);

routerAdd(
  "GET",
  "/api/groups/{id}/invite",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const group = g.ownerOnlyGroup(e);
    return e.json(200, { code: String(group.get("invite_code") || "") });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/groups/{id}/invite/reset",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const group = g.ownerOnlyGroup(e);
    group.set("invite_code", g.newInviteCode(e.app));
    e.app.save(group);
    return e.json(200, { code: String(group.get("invite_code")) });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/groups/{id}/transfer",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const group = g.ownerOnlyGroup(e);
    const data = new DynamicModel({ user: "" });
    e.bindBody(data);
    const target = String(data.user || "");
    if (!target || target === e.auth.id) {
      throw new BadRequestError("Выбери другого участника.");
    }
    if (!g.isMember(e.app, group.id, target)) {
      throw new BadRequestError("Этот человек не состоит в группе.");
    }
    group.set("owner", target);
    e.app.save(group);
    return e.json(200, { ok: true, owner: target });
  },
  $apis.requireAuth()
);

routerAdd(
  "POST",
  "/api/groups/{id}/invite/enable",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const group = g.ownerOnlyGroup(e);
    const data = new DynamicModel({ enabled: false });
    e.bindBody(data);
    group.set("invite_enabled", !!data.enabled);
    e.app.save(group);
    return e.json(200, { enabled: !!data.enabled });
  },
  $apis.requireAuth()
);

// Выход: любой участник; владелец с другими участниками сначала передаёт группу.
routerAdd(
  "POST",
  "/api/groups/{id}/leave",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const group = e.app.findRecordById("groups", e.request.pathValue("id"));
    if (!g.isMember(e.app, group.id, e.auth.id)) throw new NotFoundError("Группа не найдена.");
    const data = new DynamicModel({ remember: false });
    e.bindBody(data);
    const others = e.app.countRecords("group_members", $dbx.exp("`group` = {:g} AND user != {:u}", { g: group.id, u: e.auth.id }));
    if (group.get("owner") === e.auth.id && others > 0) {
      return e.json(409, { code: "transfer_required", message: "Сначала передай группу." });
    }
    g.leaveGroupCore(e.app, group, e.auth.id, { remember: !!data.remember });
    if (others === 0) {
      g.detachExams(e.app, group.id, ""); // остатки экзаменов группы становятся личными, не удаляются вместе с ней
      e.app.delete(group); // последний участник ушёл — группы больше нет
    }
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

// Исключить участника: только владелец. Доступы в обе стороны удаляются, подгруппы он покидает.
routerAdd(
  "POST",
  "/api/groups/{id}/kick",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const group = g.ownerOnlyGroup(e);
    const data = new DynamicModel({ user: "" });
    e.bindBody(data);
    const target = String(data.user || "");
    if (!target || target === e.auth.id) throw new BadRequestError("Выбери другого участника.");
    if (!g.isMember(e.app, group.id, target)) throw new BadRequestError("Этот человек не состоит в группе.");
    g.leaveGroupCore(e.app, group, target, { kicked: true });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

// «Вернуть прежние доступы (N)»: включает приостановленные выданные мной доступы
// тем, кто сейчас в группе.
routerAdd(
  "POST",
  "/api/groups/{id}/restore-access",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const groupId = e.request.pathValue("id");
    if (!g.isMember(e.app, groupId, e.auth.id)) throw new NotFoundError("Группа не найдена.");
    const rows = g.restorableShares(e.app, groupId, e.auth.id);
    for (const sh of rows) {
      sh.set("suspended", false);
      e.app.save(sh);
    }
    return e.json(200, { restored: rows.length });
  },
  $apis.requireAuth()
);

// Сколько прежних доступов можно вернуть в этой группе.
routerAdd(
  "GET",
  "/api/groups/{id}/restorable",
  (e) => {
    const g = require(`${__hooks}/lib_groups.js`);
    const groupId = e.request.pathValue("id");
    if (!g.isMember(e.app, groupId, e.auth.id)) throw new NotFoundError("Группа не найдена.");
    return e.json(200, { count: g.restorableCount(e.app, groupId, e.auth.id) });
  },
  $apis.requireAuth()
);

// Доступ выдаётся в рамках группы, в которой состоят и автор, и получатель.
onRecordCreateRequest((e) => {
  const g = require(`${__hooks}/lib_groups.js`);
  const owner = String(e.record.get("owner") || "");
  const grantee = String(e.record.get("grantee") || "");
  const group = String(e.record.get("group") || "");
  if (!group || !g.isMember(e.app, group, owner) || !g.isMember(e.app, group, grantee)) {
    throw new ForbiddenError("Доступ можно выдать только участнику вашей группы.");
  }
  e.record.set("suspended", false);
  e.next();
}, "lecture_shares");
