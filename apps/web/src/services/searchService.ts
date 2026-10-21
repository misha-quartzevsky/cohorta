/**
 * ============================================
 *  searchService.ts — поиск по продукту (B2)
 * ============================================
 *
 * Лекции (свои + те, что явно поделились через lecture_shares — уже
 * фильтрует `lectures.listRule`, см. pb_migrations/1787615000), чужие
 * лекции по названию (коллекция `lecture_previews`, её listRule пускает
 * только участников той же группы и только если автор включил
 * предпросмотр — содержимое туда не попадает вовсе, см. pb_hooks/
 * lecture_previews.pb.js), предметы (свои, `courses.listRule`) и
 * одногруппники (имя, через уже существующий серверный ростер —
 * прямой запрос к `users` закрыт правилом «только свой профиль»,
 * A0.5).
 *
 * Все запросы идут через правила PocketBase как есть: искать чужую
 * лекцию без доступа или не из своей группы невозможно на уровне
 * сервера, не только в интерфейсе (раздел 5 инструкции).
 */

import { pb } from "../lib/pocketbase";
import type { Course, Lecture, LecturePreview } from "../lib/types";
import { FIELDS, courseName, lectureTitle } from "../lib/types";
import { fetchMyGroups, fetchRoster } from "./groupService";
import { fetchPreviews, fetchRosterPeople, fetchShares, subjectsOf } from "./groupApi";

function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

export interface SearchLectureHit {
  id: string;
  title: string;
  courseName?: string;
  lectureNumber?: number;
  lecture: Lecture;
}

export interface SearchPreviewHit {
  id: string;
  title: string;
  ownerId: string;
}

export interface SearchCourseHit {
  id: string;
  name: string;
  lectureCount?: number;
  course: Course;
}

export interface SearchClassmateHit {
  id: string;
  name: string;
  groupName: string;
}

export interface SearchResult {
  lectures: SearchLectureHit[];
  previews: SearchPreviewHit[];
  courses: SearchCourseHit[];
  classmates: SearchClassmateHit[];
}

const EMPTY: SearchResult = { lectures: [], previews: [], courses: [], classmates: [] };

/**
 * Лекции по названию, с предметом (для обложки и подписи). Текст лекций не
 * ищем: в результатах виден только заголовок, а чужие открытые лекции (по
 * `lectures.listRule`) по тексту искаться не должны (подпись в Screen-search).
 */
async function searchLectures(query: string, limit: number): Promise<Lecture[]> {
  const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const result = await pb.collection("lectures").getList<Lecture>(1, limit, {
    sort: "-created",
    filter: `${FIELDS.lectureTitle}~"${escaped}"`,
    expand: "field",
  });
  return result.items;
}

/** Чужие лекции по названию (предпросмотр группы). Содержимое не ищем. */
async function searchPreviews(query: string, limit: number): Promise<SearchPreviewHit[]> {
  const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  try {
    const result = await pb.collection("lecture_previews").getList<LecturePreview>(1, limit, {
      filter: `${FIELDS.previewTitle}~"${escaped}"`,
      sort: "-updated",
    });
    return result.items
      .filter((p) => p.owner !== currentUserId())
      .map((p) => ({ id: p.id, title: p.title ?? "", ownerId: p.owner }));
  } catch {
    return [];
  }
}

async function searchCourses(query: string, limit: number): Promise<SearchCourseHit[]> {
  const q = query.toLowerCase();
  const all = await pb.collection("courses").getFullList<Course>({ sort: "name" });
  const matches = all.filter((c) => courseName(c).toLowerCase().includes(q)).slice(0, limit);

  const counts = await Promise.all(
    matches.map((c) =>
      pb
        .collection("lectures")
        .getList(1, 1, { filter: `${FIELDS.lectureCourse}="${c.id}"` })
        .then((r) => r.totalItems)
        .catch(() => undefined)
    )
  );

  return matches.map((c, i) => ({
    id: c.id,
    name: courseName(c),
    lectureCount: counts[i],
    course: c,
  }));
}

/**
 * Одногруппники по имени, во всех моих группах — через серверный
 * ростер (`/api/groups/:id/roster`, уже отдаёт только name/email).
 */
async function searchClassmates(query: string, limit: number): Promise<SearchClassmateHit[]> {
  const me = currentUserId();
  const q = query.toLowerCase();
  const groups = await fetchMyGroups();
  const rosters = await Promise.all(groups.map((g) => fetchRoster(g.id)));

  const byUser = new Map<string, SearchClassmateHit>();
  groups.forEach((g, i) => {
    for (const m of rosters[i]) {
      const uid = String(m.user ?? "");
      if (!uid || uid === me || byUser.has(uid)) continue;
      const name = m.expand?.user?.name ?? "";
      if (!name.toLowerCase().includes(q)) continue;
      byUser.set(uid, { id: uid, name, groupName: g.name });
    }
  });
  return [...byUser.values()].slice(0, limit);
}

/** Поиск по продукту: лекции, предметы, одногруппники (раздел 4 инструкции, B2). */
export async function productSearch(query: string, limit = 5): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) return EMPTY;

  const [lectures, previews, courses, classmates] = await Promise.all([
    searchLectures(q, limit),
    searchPreviews(q, limit),
    searchCourses(q, limit),
    searchClassmates(q, limit),
  ]);

  return {
    lectures: lectures.map((l) => ({
      id: l.id,
      title: lectureTitle(l),
      courseName: l.expand?.field ? courseName(l.expand.field) : undefined,
      lectureNumber: l.number,
      lecture: l,
    })),
    previews,
    courses,
    classmates,
  };
}

export function isSearchEmpty(result: SearchResult): boolean {
  return (
    result.lectures.length === 0 &&
    result.previews.length === 0 &&
    result.courses.length === 0 &&
    result.classmates.length === 0
  );
}

// ---- поиск в режиме «Группа» ------------------------------------------------------------

export interface GroupLectureHit {
  id: string;
  lecture: string;
  title: string;
  ownerId: string;
  ownerName: string;
  subject: string;
  /** Ключ предмета автора для адреса «предмет одногруппника». */
  courseKey: string;
  /** Автор открыл мне эту лекцию: можно читать. Иначе видно только название. */
  open: boolean;
}
export interface GroupSubjectHit {
  key: string;
  ownerId: string;
  ownerName: string;
  title: string;
  coverSeed: number;
  lectureCount: number;
}
export interface GroupPersonHit {
  id: string;
  name: string;
  avatar: string;
}
export interface GroupSearchResult {
  lectures: GroupLectureHit[];
  subjects: GroupSubjectHit[];
  people: GroupPersonHit[];
}

const GROUP_EMPTY: GroupSearchResult = { lectures: [], subjects: [], people: [] };

export function isGroupSearchEmpty(r: GroupSearchResult): boolean {
  return r.lectures.length === 0 && r.subjects.length === 0 && r.people.length === 0;
}

/**
 * Поиск в выбранной группе: названия лекций одногруппников (только названия: текст чужих лекций не ищется и
 * не отдаётся), их предметы и сами одногруппники. Данные приходят уже отфильтрованными правилами сервера:
 * название видно, только если автор открыл предпросмотр для этой группы.
 */
export async function groupSearch(groupId: string, query: string, limit = 5): Promise<GroupSearchResult> {
  const q = query.trim().toLowerCase();
  if (q.length < 2 || !groupId) return GROUP_EMPTY;
  const me = currentUserId();
  const [roster, previews, shares] = await Promise.all([fetchRosterPeople(groupId), fetchPreviews(groupId), fetchShares(groupId)]);
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? "Одногруппник";
  const open = new Set(shares.filter((s) => s.grantee === me && !s.suspended).map((s) => s.lecture));
  const foreign = previews.filter((p) => p.owner !== me);

  const lectures = foreign
    .filter((p) => p.title.toLowerCase().includes(q))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      lecture: p.lecture,
      title: p.title || "Без названия",
      ownerId: p.owner,
      ownerName: nameOf(p.owner),
      subject: p.courseTitle,
      courseKey: p.course || "none",
      open: open.has(p.lecture),
    }));

  const owners = [...new Set(foreign.map((p) => p.owner))];
  const subjects: GroupSubjectHit[] = [];
  for (const ownerId of owners) {
    for (const sub of subjectsOf(foreign, shares, ownerId)) {
      if (!sub.title.toLowerCase().includes(q)) continue;
      subjects.push({ key: sub.key, ownerId, ownerName: nameOf(ownerId), title: sub.title, coverSeed: sub.coverSeed, lectureCount: sub.lectures.length });
    }
  }

  const people = roster
    .filter((p) => p.id !== me && p.name.toLowerCase().includes(q))
    .slice(0, limit)
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }));

  return { lectures, subjects: subjects.slice(0, limit), people };
}
