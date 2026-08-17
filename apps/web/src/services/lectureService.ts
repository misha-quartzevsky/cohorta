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
import { FIELDS } from "../lib/types";

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

export async function createLecture(
  title: string,
  content: string,
  courseId: string
): Promise<Lecture> {
  return pb.collection("lectures").create<Lecture>({
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: safeContent(title, content),
    [FIELDS.lectureCourse]: courseId,
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
 * @returns The created Lecture record.
 */
export async function createUnassignedLecture(
  title: string,
  content: string
): Promise<Lecture> {
  return pb.collection("lectures").create<Lecture>({
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: safeContent(title, content),
  });
}

/**
 * Update an existing lecture's title and content.
 *
 * @param id      — PocketBase record ID of the lecture to update
 * @param title   — new heading
 * @param content — new body text
 * @returns The updated Lecture record.
 */
export async function updateLecture(
  id: string,
  title: string,
  content: string
): Promise<Lecture> {
  return pb.collection("lectures").update<Lecture>(id, {
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: safeContent(title, content),
  });
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