/**
 * ============================================
 *  groupApi.ts — данные экранов группы (волна C, этап 2)
 * ============================================
 *
 * Всё, что видит человек в режиме «Группа»: люди, предпросмотр, «Мой доступ»,
 * запросы, выход и передача, подгруппы. Права держит сервер (правила
 * коллекций и маршруты `pb_hooks/group*.pb.js`); здесь только запросы.
 *
 * Чужие лекции приходят как `lecture_previews` (название и предмет),
 * текст — только по выданному доступу.
 */

import { pb } from "../lib/pocketbase";
import type { Group } from "../lib/types";

export interface RosterPerson {
  /** id пользователя */
  id: string;
  name: string;
  avatar: string;
  joinedAt: string;
  previewEnabled: boolean;
}

export interface PreviewRow {
  id: string;
  lecture: string;
  owner: string;
  title: string;
  course: string;
  courseTitle: string;
  coverSeed: number;
  created: string;
}

export interface ShareRow {
  id: string;
  lecture: string;
  owner: string;
  grantee: string;
  group: string;
  subgroup: string;
  allowCopy: boolean;
  suspended: boolean;
  created: string;
}

export interface RequestRow {
  id: string;
  lecture: string;
  requester: string;
  owner: string;
  group: string;
  status: "open" | "granted" | "declined";
  created: string;
}

export interface GroupSummary {
  group: Group;
  members: number;
  openRequests: number;
  isOwner: boolean;
}

const me = () => String(pb.authStore.record?.id ?? "");

/** Значок группы: «МК-31» → «МК», «Моя группа» → «МГ». */
export function groupInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0].charAt(0) + words[1].charAt(0) : (words[0] ?? "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2);
  return letters.toUpperCase();
}

export async function fetchGroupSummaries(): Promise<GroupSummary[]> {
  const uid = me();
  if (!uid) return [];
  const memberships = await pb.collection("group_members").getFullList({
    filter: pb.filter("user = {:u}", { u: uid }),
    expand: "group",
    sort: "created",
  });
  const out: GroupSummary[] = [];
  for (const m of memberships) {
    const g = (m.expand as { group?: Group } | undefined)?.group;
    if (!g) continue;
    const [count, reqs] = await Promise.all([
      pb.collection("group_members").getList(1, 1, { filter: pb.filter("group = {:g}", { g: g.id }), fields: "id" }),
      pb.collection("access_requests").getList(1, 1, {
        filter: pb.filter("owner = {:u} && group = {:g} && status = 'open'", { u: uid, g: g.id }),
        fields: "id",
      }),
    ]);
    out.push({ group: g, members: count.totalItems, openRequests: reqs.totalItems, isOwner: g.owner === uid });
  }
  return out;
}

export async function fetchRosterPeople(groupId: string): Promise<RosterPerson[]> {
  const rows = await pb.send<
    { user: { id: string; name?: string; avatar?: string } | null; joined_at?: string; preview_enabled: boolean }[]
  >(`/api/groups/${groupId}/roster`, { method: "GET" });
  return rows
    .filter((r) => r.user)
    .map((r) => ({
      id: r.user!.id,
      name: r.user!.name || "Участник",
      avatar: r.user!.avatar || "",
      joinedAt: r.joined_at ?? "",
      previewEnabled: !!r.preview_enabled,
    }));
}

export async function fetchPreviews(groupId: string): Promise<PreviewRow[]> {
  const rows = await pb.collection("lecture_previews").getFullList({
    filter: pb.filter("group = {:g}", { g: groupId }),
    sort: "-created",
  });
  return rows.map((r) => ({
    id: r.id,
    lecture: String(r.lecture),
    owner: String(r.owner),
    title: String(r.title ?? ""),
    course: String(r.course ?? ""),
    courseTitle: String(r.course_title ?? ""),
    coverSeed: Number(r.cover_seed ?? 0),
    created: String(r.created),
  }));
}

function toShare(r: Record<string, unknown>): ShareRow {
  return {
    id: String(r.id),
    lecture: String(r.lecture),
    owner: String(r.owner),
    grantee: String(r.grantee),
    group: String(r.group ?? ""),
    subgroup: String(r.subgroup ?? ""),
    allowCopy: r.allow_copy === true,
    suspended: r.suspended === true,
    created: String(r.created),
  };
}

/** Доступы, выданные мне или мной в этой группе (читают автор и получатель). */
export async function fetchShares(groupId: string): Promise<ShareRow[]> {
  const uid = me();
  const rows = await pb.collection("lecture_shares").getFullList({
    filter: pb.filter("group = {:g} && (owner = {:u} || grantee = {:u})", { g: groupId, u: uid }),
    sort: "-created",
  });
  return rows.map((r) => toShare(r as unknown as Record<string, unknown>));
}

export async function fetchRequests(groupId: string): Promise<RequestRow[]> {
  const uid = me();
  const rows = await pb.collection("access_requests").getFullList({
    filter: pb.filter("group = {:g} && (owner = {:u} || requester = {:u})", { g: groupId, u: uid }),
    sort: "-created",
  });
  return rows.map((r) => ({
    id: r.id,
    lecture: String(r.lecture),
    requester: String(r.requester),
    owner: String(r.owner),
    group: String(r.group),
    status: r.status as RequestRow["status"],
    created: String(r.created),
  }));
}

export async function requestAccess(lectureId: string): Promise<void> {
  await pb.send(`/api/lectures/${lectureId}/request-access`, { method: "POST" });
}

export async function resolveRequest(id: string, action: "grant" | "decline", allowCopy = false): Promise<void> {
  await pb.send(`/api/access-requests/${id}/resolve`, { method: "POST", body: { action, allow_copy: allowCopy } });
}

/** Включить или выключить предпросмотр для группы (у каждой группы свой). */
export async function setGroupPreview(groupId: string, enabled: boolean): Promise<void> {
  const rows = await pb.collection("group_members").getFullList({
    filter: pb.filter("group = {:g} && user = {:u}", { g: groupId, u: me() }),
    fields: "id",
  });
  if (rows[0]) await pb.collection("group_members").update(rows[0].id, { preview_enabled: enabled });
}

export async function revokeShares(shareIds: string[]): Promise<void> {
  await Promise.all(shareIds.map((id) => pb.collection("lecture_shares").delete(id)));
}

export async function grantLecture(lectureId: string, granteeId: string, groupId: string, allowCopy: boolean): Promise<void> {
  await pb.collection("lecture_shares").create({
    lecture: lectureId,
    owner: me(),
    grantee: granteeId,
    group: groupId,
    allow_copy: allowCopy,
  });
}

export async function shareWithSubgroup(lectureId: string, subgroupId: string, allowCopy: boolean): Promise<void> {
  await pb.send(`/api/lectures/${lectureId}/share-subgroup`, { method: "POST", body: { subgroup: subgroupId, allow_copy: allowCopy } });
}

export async function copyLecture(lectureId: string, courseId: string): Promise<{ id: string; slug: string }> {
  return pb.send(`/api/lectures/${lectureId}/copy`, { method: "POST", body: { course: courseId } });
}

// ---- ссылка-приглашение, выход, передача ------------------------------------------------

export async function fetchInvite(groupId: string): Promise<{ code: string }> {
  return pb.send(`/api/groups/${groupId}/invite`, { method: "GET" });
}
export async function setInviteEnabled(groupId: string, enabled: boolean): Promise<void> {
  await pb.send(`/api/groups/${groupId}/invite/enable`, { method: "POST", body: { enabled } });
}
export async function resetInvite(groupId: string): Promise<{ code: string }> {
  return pb.send(`/api/groups/${groupId}/invite/reset`, { method: "POST" });
}
export async function leaveGroupApi(groupId: string, remember: boolean): Promise<void> {
  await pb.send(`/api/groups/${groupId}/leave`, { method: "POST", body: { remember } });
}
export async function kickMember(groupId: string, userId: string): Promise<void> {
  await pb.send(`/api/groups/${groupId}/kick`, { method: "POST", body: { user: userId } });
}
export async function transferOwner(groupId: string, userId: string): Promise<void> {
  await pb.send(`/api/groups/${groupId}/transfer`, { method: "POST", body: { user: userId } });
}
export async function restorableCount(groupId: string): Promise<number> {
  const r = await pb.send<{ count: number }>(`/api/groups/${groupId}/restorable`, { method: "GET" });
  return r.count;
}
export async function restoreAccess(groupId: string): Promise<number> {
  const r = await pb.send<{ restored: number }>(`/api/groups/${groupId}/restore-access`, { method: "POST" });
  return r.restored;
}
export async function renameGroup(groupId: string, name: string): Promise<void> {
  await pb.collection("groups").update(groupId, { name: name.trim() });
}
export async function createGroupApi(name: string): Promise<{ id: string }> {
  return pb.send("/api/groups/create", { method: "POST", body: { name: name.trim() } });
}
export async function joinGroupByCode(code: string): Promise<{ id: string; name: string; restorable: number }> {
  return pb.send("/api/groups/join", { method: "POST", body: { code: code.trim().toLowerCase() } });
}

// ---- производные для экранов ------------------------------------------------------------

export interface PersonCard extends RosterPerson {
  /** null — предпросмотр закрыт, число лекций не раскрывается. */
  lectures: number | null;
  courses: number | null;
  openedToMe: number;
  isOwner: boolean;
}

export function buildPeople(roster: RosterPerson[], previews: PreviewRow[], shares: ShareRow[], ownerId: string): PersonCard[] {
  const uid = me();
  const mine = shares.filter((s) => s.grantee === uid && !s.suspended);
  return roster
    .filter((p) => p.id !== uid)
    .map((p) => {
      const own = previews.filter((x) => x.owner === p.id);
      const courses = new Set(own.map((x) => x.course || "none"));
      return {
        ...p,
        lectures: p.previewEnabled ? own.length : null,
        courses: p.previewEnabled ? courses.size : null,
        openedToMe: mine.filter((s) => s.owner === p.id).length,
        isOwner: p.id === ownerId,
      };
    });
}

export interface SubjectGroupRow {
  key: string;
  title: string;
  coverSeed: number;
  lectures: PreviewRow[];
  openedToMe: number;
}

export function subjectsOf(previews: PreviewRow[], shares: ShareRow[], ownerId: string): SubjectGroupRow[] {
  const uid = me();
  const open = new Set(shares.filter((s) => s.grantee === uid && !s.suspended).map((s) => s.lecture));
  const map = new Map<string, SubjectGroupRow>();
  for (const p of previews.filter((x) => x.owner === ownerId)) {
    const key = p.course || "none";
    const row = map.get(key) ?? { key, title: p.courseTitle || "Без предмета", coverSeed: p.coverSeed, lectures: [], openedToMe: 0 };
    row.lectures.push(p);
    if (open.has(p.lecture)) row.openedToMe += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

export function ruDate(iso: string): string {
  const d = new Date(String(iso).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const m = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}
