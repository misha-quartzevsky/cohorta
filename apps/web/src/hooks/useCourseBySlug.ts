/**
 * ============================================
 *  useCourseBySlug.ts — Course-by-slug hook
 * ============================================
 *
 * Экрану экзамена нужен только сам курс, а `useLectures`
 * тянет вместе с ним ещё и все лекции — лишний вес там,
 * где список лекций не показывается. Тот же паттерн,
 * что `useLectureBySlug`, но для `courses`.
 */

import { useCallback } from "react";
import type { Course } from "../lib/types";
import { FIELDS } from "../lib/types";
import { errorMessage } from "../lib/format";
import { fetchBySlug } from "../services/genericService";
import { useAsyncData } from "./useAsyncData";

export interface UseCourseBySlugResult {
  course: Course | null;
  loading: boolean;
  error: string;
}

export function useCourseBySlug(slug: string): UseCourseBySlugResult {
  const fetcher = useCallback(async (): Promise<Course> => {
    try {
      return await fetchBySlug<Course>("courses", slug, FIELDS.courseSlug);
    } catch (e) {
      console.error("Ошибка загрузки курса:", e);
      throw new Error("Не удалось загрузить курс: " + errorMessage(e));
    }
  }, [slug]);

  const { data, loading, error } = useAsyncData<Course>(fetcher, !!slug);

  return { course: data, loading, error };
}

export default useCourseBySlug;
