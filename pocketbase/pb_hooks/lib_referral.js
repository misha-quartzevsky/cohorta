/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  lib_referral.js — helpers для referral.pb.js
//
//  ГРАБЛЯ JSVM: обработчик хука — изолированный scope, функции
//  верхнего уровня файла в нём не видны. Подключается через
//  require(`${__hooks}/lib_referral.js`) ВНУТРИ обработчика.
// ============================================================

const REWARD_DAYS = 14;

/** Проставить пользователю премиум: max(now, текущий) + days (в самой записи, без save). */
function bumpPremium(userRec, days) {
  const now = new Date();
  const raw = String(userRec.get("premium_until") || "");
  const base = raw ? new Date(raw.replace(" ", "T")) : now;
  const from = base instanceof Date && !isNaN(base.getTime()) && base > now ? base : now;
  const until = new Date(from.getTime() + days * 86400000);
  userRec.set("premium_until", until.toISOString());
}

/**
 * Атрибуция при вступлении в группу: если у пользователя ещё нет
 * `invited_by`, а владелец группы — не он сам, реферер = владелец.
 */
function attributeReferral(app, member) {
  const groupId = String(member.get("group") || "");
  const userId = String(member.get("user") || "");
  if (!groupId || !userId) return;

  const user = app.findRecordById("users", userId);
  if (!user) return;
  if (String(user.get("invited_by") || "")) return;

  const group = app.findRecordById("groups", groupId);
  if (!group) return;
  const ownerId = String(group.get("owner") || "");
  if (!ownerId || ownerId === userId) return;

  user.set("invited_by", ownerId);
  user.set("invited_group", groupId);
  app.save(user);
}

/**
 * Активация: если это ПЕРВАЯ лекция автора, у него есть `invited_by`
 * и награда ещё не выдана — начислить премиум обеим сторонам и
 * записать две строки premium_grants.
 */
function grantReferralReward(app, lecture) {
  const authorId = String(lecture.get("owner") || "");
  if (!authorId) return;

  const own = app.findRecordsByFilter("lectures", "owner = {:a}", "", 2, 0, {
    a: authorId,
  });
  if (!own || own.length !== 1) return; // не первая лекция

  const author = app.findRecordById("users", authorId);
  if (!author || author.get("referral_rewarded")) return;
  const inviterId = String(author.get("invited_by") || "");
  if (!inviterId) return;
  const groupId = String(author.get("invited_group") || "");

  const grants = app.findCollectionByNameOrId("premium_grants");
  app.save(
    new Record(grants, {
      user: authorId,
      days: REWARD_DAYS,
      source: "referral_invitee",
      related_user: inviterId,
      related_group: groupId,
    })
  );
  app.save(
    new Record(grants, {
      user: inviterId,
      days: REWARD_DAYS,
      source: "referral_inviter",
      related_user: authorId,
      related_group: groupId,
    })
  );

  // Автор: премиум + флаг «награда выдана» одним save.
  bumpPremium(author, REWARD_DAYS);
  author.set("referral_rewarded", true);
  app.save(author);

  // Пригласивший: свежая запись, чтобы не затереть чужие правки.
  const inviter = app.findRecordById("users", inviterId);
  if (inviter) {
    bumpPremium(inviter, REWARD_DAYS);
    app.save(inviter);
  }
}

module.exports = { REWARD_DAYS, attributeReferral, grantReferralReward };
