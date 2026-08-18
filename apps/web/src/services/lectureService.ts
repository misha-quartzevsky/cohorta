/**
 * ============================================
 *  lectureService.ts — Lecture API Service Layer
 * ============================================
 *
 * Centralizes all PocketBase calls for the
 * `lectures` collection plus a convenience
 * function for fetching a single course.
 */

import { pb } from "../lib/pocketbase";
import type { Course, Lecture } from "../lib/types";
import { FIELDS, lectureFiles } from "../lib/types";
import { slugify, uniqueSlug } from "../lib/slugify";
import { applyLectureTags } from "./tagService";

/**
 * Fetch a single course by its PocketBase ID.
 *
 * @param courseId — PocketBase record ID
 * @returns Resolves to the Course record.
 */
export async function fetchCourse(courseId: string): Promise<Course> {
  return pb.collection("courses").getOne<Course>(courseId);
}

/**
 * Fetch a single lecture by its PocketBase ID.
 *
 * @param lectureId — PocketBase record ID
 * @returns Resolves to the Lecture record.
 */
export async function fetchLecture(lectureId: string): Promise<Lecture> {
  return pb.collection("lectures").getOne<Lecture>(lectureId);
}

/**
 * Fetch a single lecture by its URL slug.
 * Falls back to a lookup by PocketBase id for legacy
 * records whose slug is still empty.
 *
 * @param slug — lecture slug (or legacy id)
 * @returns Resolves to the Lecture record.
 */
export async function fetchLectureBySlug(slug: string): Promise<Lecture> {
  try {
    return await pb
      .collection("lectures")
      .getFirstListItem<Lecture>(`${FIELDS.lectureSlug}="${slug}"`);
  } catch {
    // Legacy fallback: URL contains the record id.
    return pb.collection("lectures").getOne<Lecture>(slug);
  }
}

/**
 * Fetch all lectures that belong to `courseId`,
 * newest-first.
 *
 * @param courseId — the course whose lectures we want
 * @returns Resolves to an array of Lecture records.
 */
export async function fetchLectures(courseId: string): Promise<Lecture[]> {
  return pb.collection("lectures").getFullList<Lecture>({
    filter: `${FIELDS.lectureCourse}="${courseId}"`,
    sort: "-created",
  });
}

/**
 * Fetch the most-recent lectures across ALL courses
 * (up to `limit`).  Used by the Dashboard's
 * "Recent Files" section.
 *
 * @param limit — max number of records (default 10)
 * @returns Resolves to an array of Lecture records.
 */
export async function fetchRecentLectures(
  limit: number = 10
): Promise<Lecture[]> {
  return pb.collection("lectures").getFullList<Lecture>({
    sort: "-created",
    filter: "",
  }).then((items) => items.slice(0, limit));
}

/**
 * Create a brand-new lecture inside a course.
 *
 * @param title    — lecture heading
 * @param content  — lecture body (plain text)
 * @param courseId — course this lecture belongs to
 * @returns The created Lecture record.
 */
/**
 * `content` is a REQUIRED field in PocketBase, and an empty string
 * is rejected with a 400. Fall back to the title so the field is
 * always non-empty.
 */
function safeContent(title: string, content: string): string {
  return content && content.trim() ? content : title;
}

/**
 * All slugs currently used by lecture records.
 * Used to guarantee global slug uniqueness on create.
 */
async function takenLectureSlugs(): Promise<Set<string>> {
  const all = await pb
    .collection("lectures")
    .getFullList<Lecture>({ fields: FIELDS.lectureSlug });
  return new Set(
    all
      .map((l) => String(l[FIELDS.lectureSlug] ?? ""))
      .filter((s) => s.length > 0)
  );
}

/**
 * Generates a unique slug for a lecture title
 * (adds -1, -2, … when the base slug is taken).
 */
async function uniqueLectureSlug(title: string): Promise<string> {
  const base = slugify(title) || "lecture";
  return uniqueSlug(base, await takenLectureSlugs());
}

/**
 * Create a brand-new lecture inside a course.
 *
 * @param title    — lecture heading
 * @param content  — lecture body (plain text)
 * @param courseId — course this lecture belongs to
 * @returns The created Lecture record (includes a unique `slug`).
 */
export async function createLecture(
  title: string,
  content: string,
  courseId: string
): Promise<Lecture> {
  return pb.collection("lectures").create<Lecture>({
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: safeContent(title, content),
    [FIELDS.lectureContentRich]: content,
    [FIELDS.lectureCourse]: courseId,
    [FIELDS.lectureSlug]: await uniqueLectureSlug(title),
  });
}

/**
 * Create a brand-new lecture WITHOUT any course assigned.
 *
 * Unlike `createLecture`, the relation field is omitted entirely
 * (not sent as an empty string), which PocketBase accepts — an
 * optional relation rejects an empty-string value.
 *
 * @param title   — lecture heading
 * @param content — lecture body (plain text)
 * @returns The created Lecture record (includes a unique `slug`).
 */
export async function createUnassignedLecture(
  title: string,
  content: string
): Promise<Lecture> {
  return pb.collection("lectures").create<Lecture>({
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: safeContent(title, content),
    [FIELDS.lectureContentRich]: content,
    [FIELDS.lectureSlug]: await uniqueLectureSlug(title),
  });
}

/**
 * Update an existing lecture's title, content and tags.
 *
 * A missing slug is generated lazily (legacy records).
 *
 * @param id      — PocketBase record ID of the lecture to update
 * @param title   — new heading
 * @param content — new body text
 * @param tags    — optional: tag ids to assign (skip to leave tags untouched)
 * @returns The updated Lecture record.
 */
export async function updateLecture(
  id: string,
  title: string,
  content: string,
  tags?: string[]
): Promise<Lecture> {
  const existing = await pb.collection("lectures").getOne<Lecture>(id);
  const payload: Record<string, unknown> = {
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: safeContent(title, content),
    [FIELDS.lectureContentRich]: content,
  };
  // Lazy slug backfill for legacy records.
  if (!existing[FIELDS.lectureSlug]) {
    payload[FIELDS.lectureSlug] = await uniqueLectureSlug(title);
  }
  const updated = await pb.collection("lectures").update<Lecture>(id, payload);
  if (tags !== undefined) {
    await applyLectureTags(id, tags);
  }
  return updated;
}

/**
 * Delete a lecture by ID.
 *
 * @param id — PocketBase record ID
 */
export async function deleteLecture(id: string): Promise<void> {
  await pb.collection("lectures").delete(id);
}

/**
 * Assign an (unassigned) lecture to a course by updating
 * its course foreign-key field.
 *
 * @param lectureId — PocketBase record ID of the lecture
 * @param courseId  — target course ID (or "" to unassign)
 * @returns The updated Lecture record.
 */
export async function assignLecture(
  lectureId: string,
  courseId: string
): Promise<Lecture> {
  return pb.collection("lectures").update<Lecture>(lectureId, {
    [FIELDS.lectureCourse]: courseId,
  });
}

/**
 * Full-text search across lecture titles and bodies.
 * Searches the raw HTML in `content` / `content_rich` — good enough
 * for a live dropdown (worst case it matches a tag name).
 *
 * @param query — search substring (case-insensitive `~` contains in PB)
 * @param limit — max records to return (default 8)
 * @returns Resolves to the matching Lecture records, newest-first.
 */
export async function searchLectures(
  query: string,
  limit: number = 8
): Promise<Lecture[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];
  const escaped = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const filter = [
    `${FIELDS.lectureTitle}~"${escaped}"`,
    `${FIELDS.lectureContent}~"${escaped}"`,
    `${FIELDS.lectureContentRich}~"${escaped}"`,
  ].join(" || ");
  const result = await pb.collection("lectures").getList<Lecture>(1, limit, {
    sort: "-created",
    filter,
  });
  return result.items;
}

/** Токен картинки внутри HTML-контента, e.g. `[[file:photo.png]]`. */
const IMG_TOKEN_RE = /\[\[file:([^\]]+)\]\]/g;

/**
 * Резолвит токены `[[file:name]]` в абсолютные URL файлов PocketBase.
 * Используется на границах: перед рендером (просмотр) и перед загрузкой
 * контента в редактор.
 */
export function resolveFileTokens(html: string, lecture: Lecture): string {
  return html.replace(IMG_TOKEN_RE, (_match, name: string) =>
    pb.files.getURL(lecture, name)
  );
}

/**
 * Обратное преобразование: заменяет `src` картинок, указывающие на файлы
 * PB текущей лекции, обратно на портативные токены `[[file:name]]`.
 * Нужно при сохранении, чтобы в БД жили не абсолютные URL (ломаются при
 * смене хоста/переезде), а имена файлов.
 *
 * Распознаётся путь `/api/files/<collectionId>/<lectureId>/<filename>`
 * (collectionId из записи, либо имя коллекции «lectures» для fallback).
 */
export function tokenizePbFileUrls(html: string, lecture: Lecture): string {
  const record = lecture as unknown as Record<string, unknown>;
  const collectionId = String(record.collectionId ?? "lectures");
  const escapedId = lecture.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(src=["'][^"']*/api/files/(?:${collectionId}|lectures)/${escapedId}/)([^/?"']+)([^"']*)(["'])`,
    "g"
  );
  return html.replace(
    re,
    (_match, _prefix: string, name: string, _rest: string, quote: string) => {
      let decoded = name;
      try {
        decoded = decodeURIComponent(name);
      } catch {
        /* оставляем как есть */
      }
      return `src=${quote}[[file:${decoded}]]${quote}`;
    }
  );
}

/** Результат загрузки картинки: стабильное имя файла + абсолютный URL. */
export interface UploadedImage {
  name: string;
  url: string;
}

/**
 * Загружает картинки в поле `file` лекции (вместо Base64 внутри текста).
 * PocketBase хранит каждый файл отдельно и сам переименовывает при коллизии,
 * поэтому мы берём итоговые имена из ответа (diff против старого списка).
 *
 * @param lecture — запись лекции (используется только id)
 * @param files   — File-объекты картинок (drag&drop / paste / input)
 * @returns Для каждого нового файла: `name` (для токена) и `url` (для вставки).
 */
export async function uploadLectureImages(
  lecture: Lecture,
  files: File[]
): Promise<UploadedImage[]> {
  if (!files.length) return [];
  const fresh = await pb.collection("lectures").getOne<Lecture>(lecture.id);
  const existing = lectureFiles(fresh);
  const updated = await pb.collection("lectures").update<Lecture>(fresh.id, {
    [FIELDS.lectureFile]: [...existing, ...files],
  });
  const next = lectureFiles(updated);
  const previous = new Set(existing);
  return next
    .filter((name) => !previous.has(name))
    .map((name) => ({
      name,
      url: pb.files.getURL(updated, name),
    }));
}
