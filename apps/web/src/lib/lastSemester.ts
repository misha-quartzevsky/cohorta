/**
 * ============================================
 *  lastSemester.ts — last visited semester helper
 * ============================================
 *
 * The SemesterProvider writes the slug of every visited `/s/...` route into
 * localStorage under LAST_SEMESTER_KEY. Note routes (`/note/...`) have no
 * semester in the URL, so for the «Рабочий стол» breadcrumb we fall back to
 * this value — returning to the dashboard reopens the semester the user was
 * last working in.
 */

import { LAST_SEMESTER_KEY } from "./semesterContext";

/** Slug of the most recently visited semester ("" when none saved yet). */
export function lastSemesterSlug(): string {
  return localStorage.getItem(LAST_SEMESTER_KEY) ?? "";
}
