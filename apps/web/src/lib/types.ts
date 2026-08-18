/**
 * Базовые поля, которые PocketBase добавляет к каждой записи
 * (см. `RecordModel` в SDK). Каждый доменный тип наследует их,
 * поэтому доступны `updated`/`collectionId`/`collectionName` без
 * индексной сигнатуры `[key: string]: unknown`.
 */
export interface PbRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

export interface Course extends PbRecord {
  name: string;
  color?: string;
  slug?: string;
  /** PocketBase relation → semesters (single). */
  semesters?: string;
}

export interface Lecture extends PbRecord {
  title: string;
  content?: string;
  /** Rich-контент (тип "editor" в PB): безлимитный, хранит тот же HTML. */
  content_rich?: string;
  /** Файлы, залитые в лекцию (поле "file" в PB). */
  file?: string | string[];
  /** PocketBase relation → courses. */
  field?: string;
  slug?: string;
}

export interface Semester extends PbRecord {
  slug: string;
}

export interface Tag extends PbRecord {
  name: string;
  color?: string;
  /** Multiple-relation к лекциям (поле живёт на стороне тегов). */
  lectures?: string[];
}

export interface User extends PbRecord {
  email: string;
  name?: string;
  avatar?: string;
}

// Поля, используемые при работе с PocketBase. Имена физических полей в БД.
// `as const` — ключи становятся литеральными типами (без `string`-размытия).
export const FIELDS = {
  courseName: "name",
  courseColor: "color",
  lectureTitle: "title",
  lectureContent: "content",
  // Rich-контент (тип "editor" в PB): безлимитный, хранит тот же HTML,
  // что и `content`. Чтение идёт через lectureBody() → content_rich приоритетен.
  lectureContentRich: "content_rich",
  // Файлы (картинки), залитые в лекцию (тип "file" в PB).
  lectureFile: "file",
  // Поле в lectures, которое ссылается на курс (id из courses)
  lectureCourse: "field",
  // URL-идентификаторы (slugs)
  courseSlug: "slug",
  lectureSlug: "slug",
  semesterSlug: "slug",
  // Поле в courses, которое ссылается на семестр (id из semesters)
  courseSemester: "semesters",
  // Поля коллекции tags
  tagName: "name",
  tagColor: "color",
  // Поле в tags, которое ссылается на лекции (multiple-relation)
  tagLectures: "lectures",
} as const;

// Вспомогательные геттеры, защищающие от разной схемы в БД
export function courseName(c: Course): string {
  return String(c.name ?? "Без названия");
}

export function courseColor(c: Course): string {
  return String(c.color ?? "");
}

export function lectureTitle(l: Lecture): string {
  return String(l.title ?? "Без названия");
}

export function lectureContent(l: Lecture): string {
  return String(l.content ?? "");
}

/** Рендовый (rich) контент лекции — поле `content_rich`. */
export function lectureContentRich(l: Lecture): string {
  return String(l.content_rich ?? "");
}

/**
 * Источник контента лекции: `content_rich` приоритетен (новые лекции
 * пишутся туда), иначе — легаси-поле `content` (старые лекции).
 */
export function lectureBody(l: Lecture): string {
  return lectureContentRich(l) || lectureContent(l);
}

/** Имена файлов, прикреплённых к лекции (поле `file`). */
export function lectureFiles(l: Lecture): string[] {
  const v = l.file;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v) return [v];
  return [];
}

export function lectureCourseId(l: Lecture): string {
  return String(l.field ?? "");
}

/**
 * URL-friendly identifier of a course.
 * Falls back to the record id for legacy rows without a slug.
 */
export function courseSlug(c: Course): string {
  return c.slug ? String(c.slug) : c.id;
}

/**
 * URL-friendly identifier of a lecture.
 * Falls back to the record id for legacy rows without a slug.
 */
export function lectureSlug(l: Lecture): string {
  return l.slug ? String(l.slug) : l.id;
}

/** URL identifier of a semester (e.g. "5"). */
export function semesterSlug(s: Semester): string {
  return String(s.slug ?? "");
}

/** PocketBase id of the semester a course belongs to ("" = none). */
export function courseSemesterId(c: Course): string {
  return String(c.semesters ?? "");
}

/**
 * Превращает HTML-фрагмент лекции в plain-text сниппет:
 * вырезает теги и токены картинок `[[file:…]]`.
 */
export function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/\[\[file:[^\]]+\]\]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Плейн-текстовая выдержка лекции для плиток и результатов поиска.
 * Обрезает до `maxLen` символов (по границе не рвёт — просто обрезает).
 */
export function lectureExcerpt(l: Lecture, maxLen = 150): string {
  const text = stripHtml(lectureBody(l));
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

export function tagName(t: Tag): string {
  return String(t.name ?? "Без названия");
}

export function tagColor(t: Tag): string {
  return String(t.color ?? "");
}

/** Lecture ids that carry this tag (from the tags side of the relation). */
export function tagLectureIds(t: Tag): string[] {
  const v = t.lectures;
  return Array.isArray(v) ? v.map(String) : [];
}