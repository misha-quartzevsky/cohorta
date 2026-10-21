/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  groups_manage.pb.js — волна C, этап 1 (21.10.2026).
//
//  Группы и членство меняются только отсюда: правила коллекций
//  `groups` и `group_members` закрывают create/delete для клиента
//  (миграция 1790009000_group_access_rules.js).
//
//  POST /api/groups/create               {name}  → создать группу (владелец — я)
//  GET  /api/groups/{id}/invite                  → код приглашения (только владелец)
//  POST /api/groups/{id}/invite/reset            → новый код, участники остаются (только владелец)
//  POST /api/groups/{id}/transfer        {user}  → передать группу участнику (только владелец)
//
//  + хук на lecture_shares: доступ можно выдать только тому, кто
//  состоит с автором в одной группе.
//
//  Постороннему (не участнику) группа не раскрывается: 404, а не 403.
// ============================================================

routerAdd(
  "POST",
  "/api/groups/create",
  (e) => {
    const data = new DynamicModel({ name: "" });
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

    const groups = e.app.findCollectionByNameOrId("groups");
    const group = new Record(groups);
    group.set("name", name);
    group.set("slug", slugBase + "-" + $security.randomStringWithAlphabet(4, alphabet));
    group.set("owner", e.auth.id);
    group.set("invite_code", $security.randomStringWithAlphabet(8, alphabet));
    e.app.save(group);

    const members = e.app.findCollectionByNameOrId("group_members");
    const member = new Record(members);
    member.set("group", group.id);
    member.set("user", e.auth.id);
    e.app.save(member);

    return e.json(200, { id: group.id, name: group.get("name"), slug: group.get("slug") });
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
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    group.set("invite_code", $security.randomStringWithAlphabet(8, alphabet));
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

// Выдать доступ к лекции можно только участнику общей с автором группы.
onRecordCreateRequest((e) => {
  const g = require(`${__hooks}/lib_groups.js`);
  const owner = String(e.record.get("owner") || "");
  const grantee = String(e.record.get("grantee") || "");
  if (!g.shareGroupId(e.app, owner, grantee)) {
    throw new ForbiddenError("Доступ можно выдать только участнику вашей группы.");
  }
  e.next();
}, "lecture_shares");
