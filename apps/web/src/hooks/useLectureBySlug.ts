/**
 * ============================================
 *  useLectureBySlug.ts — Lecture-by-slug hook
 * ============================================
 *
 * Resolves a lecture by its URL slug (with legacy-id
 * fallback) using the shared useAsyncData lifecycle.
 * Removes the duplicated fetch/loading/error code
 * from LectureView and LectureEdit.
 */

import { useCallback } from "react";
import type { Lecture } from "../lib/types";
import { FIELDS } from "../lib/types";
import { errorMessage } from "../lib/format";
import { fetchBySlug } from "../services/genericService";
import { useAsyncData } from "./useAsyncData";

export interface UseLectureBySlugResult {
  lecture: Lecture | null;
  loading: boolean;
  error: string;
}

/**
 * Resolves a single lecture by its URL slug.
 *
 * @param slug — the lecture's slug (or legacy PocketBase id)
 * @returns {UseLectureBySlugResult} lecture record, loading, error
 */
export function useLectureBySlug(slug: string): UseLectureBySlugResult {
  const fetcher = useCallback(async (): Promise<Lecture> => {
    try {
      return await fetchBySlug<Lecture>("lectures", slug, FIELDS.lectureSlug);
    } catch (e) {
      console.error("Ошибка загрузки записи:", e);
      throw new Error("Не удалось загрузить запись: " + errorMessage(e));
    }
  }, [slug]);

  const { data, loading, error } = useAsyncData<Lecture>(fetcher, !!slug);

  return { lecture: data, loading, error };
}

export default useLectureBySlug;
