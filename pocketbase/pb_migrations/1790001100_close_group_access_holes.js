/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  A0.5 (разведка 2026-10-18) — дыры в доступе: groups, users.
//
//  groups.listRule/viewRule были "@request.auth.id != ''" —
//  любой вошедший пользователь мог прочитать ВСЕ группы, включая
//  invite_code чужих групп (не только найденных по вводу кода).
//  Это и был исходный способ вступления (groupService.ts искал
//  группу по invite_code напрямую через API) — после ужесточения
//  правила этот путь закрывается, вместо него сервер даёт два
//  маршрута (pb_hooks/groups_access.pb.js): POST /api/groups/join
//  (вступление по коду) и GET /api/groups/search (нечёткий поиск
//  по названию) — оба отдают только name/id/slug, не invite_code.
//
//  users.viewRule был "@request.auth.id != ''" — любой вошедший
//  видел чужой профиль целиком (город, вуз, степень и т. д.).
//  Сужаем до "только свой профиль"; ростер одногруппников теперь
//  отдаёт GET /api/groups/:id/roster — только name/email нужных
//  для подписи участника, остальные поля профиля туда не попадают.
//
//  group_members, lecture_shares, lecture_previews уже были
//  правильно ограничены (проверено разведкой, без изменений).
// ============================================================

const GROUP_READ =
  "owner = @request.auth.id || (@collection.group_members.group ?= id && @collection.group_members.user ?= @request.auth.id)";
const USERS_READ = "id = @request.auth.id";

migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  console.log("groups.listRule before:", JSON.stringify(groups.listRule));
  unmarshal(
    {
      listRule: GROUP_READ,
      viewRule: GROUP_READ,
    },
    groups
  );
  app.save(groups);

  const users = app.findCollectionByNameOrId("users");
  console.log("users.viewRule before:", JSON.stringify(users.viewRule));
  users.viewRule = USERS_READ;
  app.save(users);

  console.log("group/users access holes closed: groups (member/owner only), users (self only)");
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  unmarshal(
    {
      listRule: "@request.auth.id != \"\"",
      viewRule: "@request.auth.id != \"\"",
    },
    groups
  );
  app.save(groups);

  const users = app.findCollectionByNameOrId("users");
  users.viewRule = "@request.auth.id != \"\"";
  app.save(users);
})
