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

/**
 * Fetch every course, newest-first.
 *
 * @returns Resolves to an array of all Course records.
 */
export async function fetchCourses(): Promise<Course[]> {
  return pb.collection("courses").getFullList<Course>({
    sort: "-created",
  });
}

/**
 * Create a new course record.
 *
 * @param name  — display name for the course (e.g. "Философия")
 * @param color — optional HEX color; defaults to a random palette color
 * @returns The freshly created Course record (includes generated `id`).
 */
export async function createCourse(
  name: string,
  color?: string
): Promise<Course> {
  const payload: Record<string, unknown> = {
    [FIELDS.courseName]: name,
  };
  const resolvedColor = color && color.trim() ? color.trim() : randomCourseColor();
  payload[FIELDS.courseColor] = resolvedColor;
  return pb.collection("courses").create<Course>(payload);
}

/**
 * Update an existing course's name and/or color.
 *
 * @param id    — PocketBase record ID
 * @param name  — new display name
 * @param color — optional new HEX color (keeps existing if omitted)
 * @returns The updated Course record.
 */
export async function updateCourse(
  id: string,
  name: string,
  color?: string
): Promise<Course> {
  const payload: Record<string, unknown> = {
    [FIELDS.courseName]: name,
  };
  if (color && color.trim()) {
    payload[FIELDS.courseColor] = color.trim();
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
        const title: unknown = last.items[0][FIELDS.lectureTitle];
        prev[c.id] = title ? String(title) : "";
      }
    } catch {
      // No lectures for this course — leave entry empty.
    }
  }
  return prev;
}