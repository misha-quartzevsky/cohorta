/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  referral.pb.js — реферальная механика.
//
//  1. group_members create → атрибуция: реферер = owner группы,
//     по чьему invite_code человек вступил (единая ссылка).
//  2. lectures create → активация: первая лекция приглашённого
//     даёт двусторонний бонус (14 дней премиума + запись в
//     premium_grants) приглашённому и владельцу группы.
//
//  Награда — НЕ за регистрацию, а за активацию (первый вклад).
//  Ошибки логируются, создание записи не роняют.
//
//  Хелперы — lib_referral.js, require() ВНУТРИ обработчика
//  (JSVM изолирует scope обработчиков).
// ============================================================

onRecordAfterCreateSuccess((e) => {
  try {
    const lib = require(`${__hooks}/lib_referral.js`);
    lib.attributeReferral(e.app, e.record);
  } catch (err) {
    console.log("[referral] attribution failed:", err);
  }
  e.next();
}, "group_members");

onRecordAfterCreateSuccess((e) => {
  try {
    const lib = require(`${__hooks}/lib_referral.js`);
    lib.grantReferralReward(e.app, e.record);
  } catch (err) {
    console.log("[referral] reward failed:", err);
  }
  e.next();
}, "lectures");
