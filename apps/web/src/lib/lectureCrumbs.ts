/**
 * ============================================
 *  lectureCrumbs.ts — breadcrumb builder
 * ============================================
 *
 * Builds the Header breadcrumbs for the lecture view
 * and edit pages, removing duplicated chain-building
 * between LectureView and LectureEdit.
 */

import type { Course } from "./types";
import { courseName } from "./types";
import type { Crumb } from "../components/Header";

interface LectureCrumbsOptions {
  /** Semester slug from the URL (used for the links). */
  semesterSlug?: string;
  /** Parent course (null/undefined in note context). */
  course?: Course | null;
  /** Course slug for the course link. */
  courseSlug?: string;
  /** Final crumb label (lecture title). */
  title: string;
  /** Fallback label when `title` is empty (e.g. edit page). */
  finalFallback?: string;
}

/**
 * Builds the breadcrumb chain «Рабочий стол → [курс] → запись».
 * The course crumb is omitted when there is no course (notes).
 *
 * @param opts — semester/course/title context
 * @returns an array of Crumb objects for the Header.
 */
export function lectureCrumbs({
  semesterSlug,
  course,
  courseSlug,
  title,
  finalFallback = "Запись",
}: LectureCrumbsOptions): Crumb[] {
  const sem = semesterSlug ?? "";
  const crumbs: Crumb[] = [{ label: "Рабочий стол", to: `/s/${sem}` }];

  if (course && courseSlug) {
    crumbs.push({
      label: courseName(course),
      to: `/s/${sem}/${courseSlug}`,
    });
  }

  crumbs.push({ label: title || finalFallback });
  return crumbs;
}

export default lectureCrumbs;
