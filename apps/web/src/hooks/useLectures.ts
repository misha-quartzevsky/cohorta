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
import { errorMessage } from "../lib/format";
import {
  fetchLectures,
  deleteLecture as deleteLectureService,
} from "../services/lectureService";
import { fetchCourseBySlug } from "../services/courseService";

export interface UseLecturesResult {
  course: Course | null;
  lectures: Lecture[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  deleteLecture: (id: string) => Promise<void>;
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
  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!courseSlug) return;
    setLoading(true);
    setError("");

    // 1. Resolve the course by slug (for the page title + lecture filter)
    let resolved: Course | null = null;
    try {
      resolved = await fetchCourseBySlug(courseSlug);
      setCourse(resolved);
    } catch (e) {
      console.error("Ошибка загрузки курса:", e);
      setError("Не удалось загрузить курс.");
      setLoading(false);
      return;
    }

    // 2. Fetch the lectures for this course
    try {
      const records = await fetchLectures(resolved.id);
      setLectures(records);
    } catch (e) {
      console.error("Ошибка загрузки лекций:", e);
      setError(
        "Не удалось загрузить лекции: " + errorMessage(e)
      );
    } finally {
      setLoading(false);
    }
  }, [courseSlug]);

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
          "Не удалось удалить лекцию: " + errorMessage(e)
        );
      }
    },
    [load]
  );

  useEffect(() => {
    if (!courseSlug) {
      setCourse(null);
      setLectures([]);
      setLoading(false);
      return;
    }
    void load();
  }, [load, courseSlug]);

  return {
    course,
    lectures,
    loading,
    error,
    refetch: load,
    deleteLecture,
  };
}