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

import { useCallback, useEffect, useState } from "react";
import type { Course, Lecture } from "../lib/types";
import {
  fetchCourse,
  fetchLectures,
  deleteLecture as deleteLectureService,
} from "../services/lectureService";

export interface UseLecturesResult {
  course: Course | null;
  lectures: Lecture[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  deleteLecture: (id: string) => Promise<void>;
}

/**
 * React hook that manages the lectures data
 * lifecycle for a course.
 *
 * Fetches both the parent course record and all
 * its lectures in a single pass.
 *
 * @param courseId — PocketBase record ID of the parent course
 * @returns {UseLecturesResult} course record, lectures array,
 *          loading/error flags, refetch, and deleteLecture.
 */
export function useLectures(courseId: string): UseLecturesResult {
  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    // 1. Fetch the course details (for the page title)
    try {
      const c = await fetchCourse(courseId);
      setCourse(c);
    } catch (e) {
      console.error("Ошибка загрузки курса:", e);
      setError("Не удалось загрузить курс.");
    }

    // 2. Fetch the lectures for this course
    try {
      const records = await fetchLectures(courseId);
      setLectures(records);
    } catch (e) {
      console.error("Ошибка загрузки лекций:", e);
      setError(
        "Не удалось загрузить лекции: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  /**
   * Delete a lecture and refresh the list.
   *
   * @param id — PocketBase record ID of the lecture
   */
  const deleteLecture = useCallback(
    async (id: string) => {
      try {
        await deleteLectureService(id);
        await load();
      } catch (e) {
        console.error("Ошибка удаления лекции:", e);
        setError(
          "Не удалось удалить лекцию: " +
            (e instanceof Error ? e.message : String(e))
        );
      }
    },
    [load]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    course,
    lectures,
    loading,
    error,
    refetch: load,
    deleteLecture,
  };
}