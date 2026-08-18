/**
 * ============================================
 *  genericService.ts — Reusable data helpers
 * ============================================
 *
 * Shared helpers that remove duplicated data logic
 * across the per-collection services:
 *
 *  - `fetchBySlug` — resolve a record by its URL slug,
 *    falling back to a PocketBase id for legacy rows.
 *  - `uniqueSlugForCollection` — build a globally-unique
 *    slug for any collection's slug field.
 */

import { pb } from "../lib/pocketbase";
import type { PbRecord } from "../lib/types";
import { uniqueSlug } from "../lib/slugify";

/**
 * Fetch a single record by its URL slug.
 *
 * Tries a filter lookup on `slugField`; when nothing matches
 * (legacy records whose slug is still empty, where the URL
 * actually holds the PocketBase id) it falls back to a direct
 * `getOne` by id.
 *
 * @param collection — PocketBase collection name (e.g. "lectures")
 * @param slug       — the record's slug (or legacy id)
 * @param slugField  — physical field name holding the slug
 * @returns Resolves to the record.
 */
export async function fetchBySlug<T extends PbRecord>(
  collection: string,
  slug: string,
  slugField: string
): Promise<T> {
  try {
    return await pb
      .collection(collection)
      .getFirstListItem<T>(`${slugField}="${slug}"`);
  } catch {
    // Legacy fallback: URL contains the record id.
    return pb.collection(collection).getOne<T>(slug);
  }
}

/**
 * Returns `base` unchanged if it is free, otherwise a unique
 * slug with the smallest free numeric suffix (`-1`, `-2`, …)
 * across every record in `collection`.
 *
 * @param collection — PocketBase collection name (e.g. "courses")
 * @param slugField  — physical field name holding the slug
 * @param base       — desired (already slugified) base slug
 * @returns a slug that is globally unique within the collection
 */
export async function uniqueSlugForCollection(
  collection: string,
  slugField: string,
  base: string
): Promise<string> {
  const all = await pb.collection(collection).getFullList({
    fields: slugField,
  });
  const taken = new Set(
    all
      .map((item) => (item[slugField] ? String(item[slugField]) : ""))
      .filter((s) => s.length > 0)
  );
  return uniqueSlug(base, taken);
}
