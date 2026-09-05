/**
 * ============================================
 *  courseService.ts — Course API Service Layer
 * ============================================
 *
 * Centralizes all PocketBase calls related to the
 * `courses` collection: fetch all, create, update,
 * delete, and fetch latest lecture titles.
 */

import { pb } from "../lib/pocketbase";
import type { Course, Lecture } from "../lib/types";
import { FIELDS } from "../lib/types";
import { randomCourseColor } from "../lib/colors";
import { slugify } from "../lib/slugify";
import { uniqueSlugForCollection } from "./genericService";

/** Id текущего пользователя ("" — не залогинен). */
function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

/**
 * Fetch every course, newest-first.
 *
 * @param semesterId — optional PocketBase id of a semester;
 *                     when set, only that semester's courses are returned
 * @returns Resolves to an array of all Course records.
 */
export async function fetchCourses(semesterId?: string): Promise<Course[]> {
  return pb.collection("courses").getFullList<Course>({
    sort: "-updated",
    filter: semesterId ? `${FIELDS.courseSemester}="${semesterId}"` : "",
  });
}

/**
 * Create a new course record.
 *
 * @param name       — display name for the course (e.g. "Философия")
 * @param color      — optional HEX color; defaults to a random palette color
 * @param semesterId — optional id of the semester the course belongs to
 * @returns The freshly created Course record (includes generated `id` and `slug`).
 */
export async function createCourse(
  name: string,
  color?: string,
  semesterId?: string
): Promise<Course> {
  const payload: Record<string, unknown> = {
    [FIELDS.courseName]: name,
    [FIELDS.courseOwner]: currentUserId(),
    [FIELDS.courseSlug]: await uniqueSlugForCollection(
      "courses",
      FIELDS.courseSlug,
      slugify(name) || "course"
    ),
  };
  const resolvedColor = color && color.trim() ? color.trim() : randomCourseColor();
  payload[FIELDS.courseColor] = resolvedColor;
  if (semesterId) {
    payload[FIELDS.courseSemester] = semesterId;
  }
  return pb.collection("courses").create<Course>(payload);
}

/**
 * Update an existing course's name and/or color.
 *
 * A missing slug is generated lazily (legacy records).
 * Passing `semesterId` moves the course to that semester
 * (pass "" to unassign it from any semester).
 *
 * @param id         — PocketBase record ID
 * @param name       — new display name
 * @param color      — optional new HEX color (keeps existing if omitted)
 * @param semesterId — optional target semester id (undefined = keep current)
 * @returns The updated Course record.
 */
export async function updateCourse(
  id: string,
  name: string,
  color?: string,
  semesterId?: string
): Promise<Course> {
  const existing = await pb.collection("courses").getOne<Course>(id);
  const payload: Record<string, unknown> = {
    [FIELDS.courseName]: name,
  };
  // Lazy slug backfill for legacy records.
  if (!existing.slug) {
    payload[FIELDS.courseSlug] = await uniqueSlugForCollection(
      "courses",
      FIELDS.courseSlug,
      slugify(name) || "course"
    );
  }
  // Lazy owner backfill (legacy rows with owner="" are editable by anyone).
  if (!existing.owner && currentUserId()) {
    payload[FIELDS.courseOwner] = currentUserId();
  }
  if (color && color.trim()) {
    payload[FIELDS.courseColor] = color.trim();
  }
  if (semesterId !== undefined) {
    payload[FIELDS.courseSemester] = semesterId;
  }
  return pb.collection("courses").update<Course>(id, payload);
}

/**
 * Delete a course by ID.  Note: PocketBase cascade-delete
 * is not configured by default — the caller should ensure
 * lectures are deleted or reassigned first.
 *
 * @param id — PocketBase record ID
 */
export async function deleteCourse(id: string): Promise<void> {
  await pb.collection("courses").delete(id);
}

/**
 * For each course in the array, fetch the most-recent
 * lecture's title.  Runs requests sequentially to avoid
 * PocketBase rate-limit bursts.
 *
 * @param courses — current course list
 * @returns A map: `{ [courseId]: "Last lecture title" }`
 */
export async function fetchLatestLectureTitles(
  courses: Course[]
): Promise<Record<string, string>> {
  const prev: Record<string, string> = {};
  for (const c of courses) {
    try {
      const last = await pb.collection("lectures").getList<Lecture>(1, 1, {
        filter: `${FIELDS.lectureCourse}="${c.id}"`,
        sort: "-created",
      });
      if (last.items[0]) {
        prev[c.id] = last.items[0].title;
      }
    } catch {
      // No lectures for this course — leave entry empty.
    }
  }
  return prev;
}