/**
 * ============================================
 *  semesterService.ts — Semester API Service
 * ============================================
 *
 * Centralizes all PocketBase calls related to
 * the `semesters` collection.  A semester is
 * identified in URLs by its `slug` field
 * (e.g. "5", "6", …), which is unique.
 */

import { pb } from "../lib/pocketbase";
import type { Semester } from "../lib/types";
import { FIELDS, semesterSlug } from "../lib/types";

/**
 * Fetch every semester, ordered numerically by slug
 * ("1", "2", …, "10", "11") when the slug is a number.
 *
 * @returns Resolves to an array of Semester records.
 */
export async function fetchSemesters(): Promise<Semester[]> {
  const records = await pb
    .collection("semesters")
    .getFullList<Semester>({ sort: FIELDS.semesterSlug });

  // Textual sort puts "10" before "2"; order numerically when possible.
  return [...records].sort((a, b) => {
    const na = Number.parseInt(semesterSlug(a), 10);
    const nb = Number.parseInt(semesterSlug(b), 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return semesterSlug(a).localeCompare(semesterSlug(b));
  });
}

/**
 * Fetch a single semester by its slug (URL identifier).
 *
 * @param slug — semester slug (e.g. "5")
 * @returns Resolves to the Semester record.
 */
export async function fetchSemesterBySlug(slug: string): Promise<Semester> {
  return pb
    .collection("semesters")
    .getFirstListItem<Semester>(`${FIELDS.semesterSlug}="${slug}"`);
}

/**
 * Fetch a single semester by its PocketBase ID.
 *
 * @param id — PocketBase record ID
 * @returns Resolves to the Semester record.
 */
export async function fetchSemester(id: string): Promise<Semester> {
  return pb.collection("semesters").getOne<Semester>(id);
}
