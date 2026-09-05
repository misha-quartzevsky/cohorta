/**
 * ============================================
 *  shareService.ts — точечный доступ к лекциям (lecture_shares)
 * ============================================
 *
 * Паттерн Google Docs: автор явно выдаёт полный доступ к
 * конкретной лекции конкретному человеку и может отозвать его
 * так же точечно (удаление одной строки), не влияя на остальных.
 *
 * Кандидаты на выдачу — участники групп автора (ростеры).
 */

import { pb } from "../lib/pocketbase";
import type { LectureShare, GroupMember, User } from "../lib/types";
import { FIELDS, memberUserId } from "../lib/types";
import { userName } from "../lib/format";

/** Id текущего пользователя ("" — не залогинен). */
function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

/** Активные выдачи доступа к лекции (для автора). */
export async function fetchShares(lectureId: string): Promise<LectureShare[]> {
  if (!lectureId) return [];
  return pb.collection("lecture_shares").getFullList<LectureShare>({
    filter: pb.filter(`${FIELDS.shareLecture} = {:l}`, { l: lectureId }),
    expand: FIELDS.shareGrantee,
    sort: "created",
  });
}

/**
 * Выдать полный доступ к лекции пользователю. `owner` — текущий
 * пользователь (правило требует, чтобы он был автором лекции).
 * Идемпотентно: повторная выдача тому же человеку — no-op.
 */
export async function grantAccess(
  lectureId: string,
  granteeId: string
): Promise<void> {
  const owner = currentUserId();
  if (!owner) throw new Error("Нужно войти, чтобы выдать доступ.");
  try {
    await pb.collection("lecture_shares").create<LectureShare>({
      [FIELDS.shareLecture]: lectureId,
      [FIELDS.shareOwner]: owner,
      [FIELDS.shareGrantee]: granteeId,
    });
  } catch (e) {
    // UNIQUE(lecture, grantee) — уже выдан, это не ошибка.
    if (!/not unique/i.test(String((e as Error).message))) throw e;
  }
}

/** Мгновенный индивидуальный отзыв — удаление одной строки выдачи. */
export async function revokeAccess(shareId: string): Promise<void> {
  await pb.collection("lecture_shares").delete(shareId);
}

export interface ShareCandidate {
  id: string;
  name: string;
}

/**
 * Кандидаты на выдачу доступа — уникальные участники всех групп,
 * где состоит текущий пользователь, кроме самого пользователя.
 */
export async function fetchShareCandidates(): Promise<ShareCandidate[]> {
  const me = currentUserId();
  if (!me) return [];

  const myMemberships = await pb
    .collection("group_members")
    .getFullList<GroupMember>({
      filter: pb.filter(`${FIELDS.memberUser} = {:u}`, { u: me }),
      fields: "group",
    });
  const groupIds = [...new Set(myMemberships.map((m) => String(m.group)))];
  if (groupIds.length === 0) return [];

  const orFilter = groupIds
    .map((id) => `${FIELDS.memberGroup}="${id}"`)
    .join(" || ");
  const rosters = await pb
    .collection("group_members")
    .getFullList<GroupMember>({
      filter: `(${orFilter})`,
      expand: FIELDS.memberUser,
    });

  const byId = new Map<string, ShareCandidate>();
  for (const m of rosters) {
    const uid = memberUserId(m);
    if (!uid || uid === me || byId.has(uid)) continue;
    const u = m.expand?.user as User | undefined;
    byId.set(uid, { id: uid, name: u ? userName(u) : uid });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
