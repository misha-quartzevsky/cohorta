export interface Course {
  id: string;
  name: string;
  color?: string;
  created: string;
  [key: string]: unknown;
}

export interface Lecture {
  id: string;
  title: string;
  content?: string;
  created: string;
  field?: string;
  [key: string]: unknown;
}

export interface Note {
  id: string;
  title: string;
  content?: string;
  created: string;
  courseId?: string; // relation to a Course; null = unassigned
  [key: string]: unknown;
}

export interface Semester {
  id: string;
  slug: string; // URL identifier, e.g. "5"
  created: string;
  [key: string]: unknown;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  // Multiple-relation to lectures (the field lives on the tags collection).
  lectures?: string[];
  created: string;
  [key: string]: unknown;
}

// Поля, используемые при работе с PocketBase.
const COURSE_NAME_FIELD = "name";
const COURSE_COLOR_FIELD = "color";
const LECTURE_TITLE_FIELD = "title";
const LECTURE_CONTENT_FIELD = "content";
// Поле в lectures, которое ссылается на курс (id из courses)
const LECTURE_COURSE_FIELD = "field";
const NOTE_TITLE_FIELD = "title";
const NOTE_CONTENT_FIELD = "content";
// Поле в notes, которое ссылается на курс (id из courses)
const NOTE_COURSE_FIELD = "courseId";
// URL-идентификаторы (slugs)
const COURSE_SLUG_FIELD = "slug";
const LECTURE_SLUG_FIELD = "slug";
const SEMESTER_SLUG_FIELD = "slug";
// Поле в courses, которое ссылается на семестр (id из semesters)
const COURSE_SEMESTER_FIELD = "semesters";
// Поля коллекции tags
const TAG_NAME_FIELD = "name";
const TAG_COLOR_FIELD = "color";
// Поле в tags, которое ссылается на лекции (multiple-relation)
const TAG_LECTURES_FIELD = "lectures";

export const FIELDS = {
  courseName: COURSE_NAME_FIELD,
  courseColor: COURSE_COLOR_FIELD,
  lectureTitle: LECTURE_TITLE_FIELD,
  lectureContent: LECTURE_CONTENT_FIELD,
  lectureCourse: LECTURE_COURSE_FIELD,
  noteTitle: NOTE_TITLE_FIELD,
  noteContent: NOTE_CONTENT_FIELD,
  noteCourse: NOTE_COURSE_FIELD,
  courseSlug: COURSE_SLUG_FIELD,
  lectureSlug: LECTURE_SLUG_FIELD,
  semesterSlug: SEMESTER_SLUG_FIELD,
  courseSemester: COURSE_SEMESTER_FIELD,
  tagName: TAG_NAME_FIELD,
  tagColor: TAG_COLOR_FIELD,
  tagLectures: TAG_LECTURES_FIELD,
};

// Вспомогательные геттеры, защищающие от разной схемы в БД
export function courseName(c: Course): string {
  return String(c[COURSE_NAME_FIELD] ?? c.name ?? "Без названия");
}

export function courseColor(c: Course): string {
  const v = c[COURSE_COLOR_FIELD] ?? c.color ?? "";
  return v ? String(v) : "";
}

export function lectureTitle(l: Lecture): string {
  return String(l[LECTURE_TITLE_FIELD] ?? l.title ?? "Без названия");
}

export function lectureContent(l: Lecture): string {
  return String(l[LECTURE_CONTENT_FIELD] ?? l.content ?? "");
}

export function lectureCourseId(l: Lecture): string {
  return String(l[LECTURE_COURSE_FIELD] ?? "");
}

export function noteTitle(n: Note): string {
  return String(n[NOTE_TITLE_FIELD] ?? n.title ?? "Без названия");
}

export function noteContent(n: Note): string {
  return String(n[NOTE_CONTENT_FIELD] ?? n.content ?? "");
}

export function noteCourseId(n: Note): string {
  return String(n[NOTE_COURSE_FIELD] ?? "");
}

/**
 * URL-friendly identifier of a course.
 * Falls back to the record id for legacy rows without a slug.
 */
export function courseSlug(c: Course): string {
  const v = c[COURSE_SLUG_FIELD] ?? c.slug ?? "";
  return v ? String(v) : c.id;
}

/**
 * URL-friendly identifier of a lecture.
 * Falls back to the record id for legacy rows without a slug.
 */
export function lectureSlug(l: Lecture): string {
  const v = l[LECTURE_SLUG_FIELD] ?? l.slug ?? "";
  return v ? String(v) : l.id;
}

/** URL identifier of a semester (e.g. "5"). */
export function semesterSlug(s: Semester): string {
  return String(s[SEMESTER_SLUG_FIELD] ?? s.slug ?? "");
}

/** PocketBase id of the semester a course belongs to ("" = none). */
export function courseSemesterId(c: Course): string {
  return String(c[COURSE_SEMESTER_FIELD] ?? "");
}

export function tagName(t: Tag): string {
  return String(t[TAG_NAME_FIELD] ?? t.name ?? "Без названия");
}

export function tagColor(t: Tag): string {
  const v = t[TAG_COLOR_FIELD] ?? t.color ?? "";
  return v ? String(v) : "";
}

/** Lecture ids that carry this tag (from the tags side of the relation). */
export function tagLectureIds(t: Tag): string[] {
  const v = t[TAG_LECTURES_FIELD] ?? t.lectures;
  return Array.isArray(v) ? v.map(String) : [];
}