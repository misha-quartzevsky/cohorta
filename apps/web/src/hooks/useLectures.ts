/**
 * ============================================
 *  useLectures.ts — Lectures Data Hook
 * ============================================
 *
 * Manages the lecture data lifecycle for a
 * given course: loading, error, refetch, and
 * delete.  Create/update flows use the
 * LectureEditor component which calls the
 * service layer directly.
 */

import { useCallback } from "react";
import type { Course, Lecture } from "../lib/types";
import { FIELDS } from "../lib/types";
import { errorMessage } from "../lib/format";
import {
  fetchLectures,
  deleteLecture as deleteLectureService,
} from "../services/lectureService";
import { fetchBySlug } from "../services/genericService";
import { useAsyncData } from "./useAsyncData";

export interface UseLecturesResult {
  course: Course | null;
  lectures: Lecture[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  deleteLecture: (id: string) => Promise<void>;
}

/** Data produced by the fetcher: the resolved course + its lectures. */
interface LectureBundle {
  course: Course;
  lectures: Lecture[];
}

/**
 * React hook that manages the lecture data
 * lifecycle for a course.
 *
 * Looks up the parent course by its URL slug and
 * fetches all its lectures in a single pass.
 *
 * @param courseSlug — URL slug of the parent course
 * @returns {UseLecturesResult} course record, lectures array,
 *          loading/error flags, refetch, and deleteLecture.
 */
export function useLectures(courseSlug: string): UseLecturesResult {
  const fetcher = useCallback(async (): Promise<LectureBundle> => {
    // 1. Resolve the course by slug (for the page title + lecture filter)
    let resolved: Course;
    try {
      resolved = await fetchBySlug<Course>(
        "courses",
        courseSlug,
        FIELDS.courseSlug
      );
    } catch (e) {
      console.error("Ошибка загрузки курса:", e);
      throw new Error("Не удалось загрузить курс.");
    }

    // 2. Fetch the lectures for this course
    try {
      const records = await fetchLectures(resolved.id);
      return { course: resolved, lectures: records };
    } catch (e) {
      console.error("Ошибка загрузки лекций:", e);
      throw new Error("Не удалось загрузить лекции: " + errorMessage(e));
    }
  }, [courseSlug]);

  const { data, loading, error, setError, refetch } = useAsyncData<
    LectureBundle
  >(fetcher, !!courseSlug);

  /**
   * Delete a lecture and refresh the list.
   *
   * @param id — PocketBase record ID of the lecture
   */
  const deleteLecture = useCallback(
    async (id: string) => {
      try {
        await deleteLectureService(id);
        await refetch();
      } catch (e) {
        console.error("Ошибка удаления лекции:", e);
        setError(
          "Не удалось удалить лекцию: " + errorMessage(e)
        );
      }
    },
    [refetch, setError]
  );

  return {
    course: data?.course ?? null,
    lectures: data?.lectures ?? [],
    loading,
    error,
    refetch,
    deleteLecture,
  };
}