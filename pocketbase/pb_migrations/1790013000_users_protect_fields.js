/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Аудит безопасности 2026-10, волна 1: A-2 / A-3 / B-6.
//
//  users.premium_until, referral_rewarded, invited_by, invited_group ведёт только хук
//  (referral.pb.js через app.save, в обход правил). Клиент их не пишет: ни при регистрации,
//  ни при правке своей записи. Раньше PATCH {"premium_until": "2099-..."} проходил, а сброс
//  referral_rewarded позволял получать награду раз за разом.
//  onboarding_completed остаётся записываемым: его ставит мастер (onboardingService.completeOnboarding).
//
//    createRule : было "" (открытая регистрация) → запрет четырёх полей
//    updateRule : было `id = @request.auth.id` → то же + запрет четырёх полей
//
//  DOWN возвращает прежние правила точно: createRule "" и исходный updateRule.
// ============================================================

const GUARD =
  '@request.body.premium_until:isset = false && @request.body.referral_rewarded:isset = false && ' +
  '@request.body.invited_by:isset = false && @request.body.invited_group:isset = false';
const WAS_UPDATE = "id = @request.auth.id";
const NOW_UPDATE = `${WAS_UPDATE} && ${GUARD}`;

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = GUARD;
  users.updateRule = NOW_UPDATE;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = "";
  users.updateRule = WAS_UPDATE;
  app.save(users);
});
