/**
 * ============================================
 *  useCourses.ts — Courses Data Hook
 * ============================================
 *
 * Encapsulates the data-fetching lifecycle for
 * the course list: loading, error, refetch, create,
 * update, and delete.  Pages call the hook and
 * render the returned state — no `pb` calls leak
 * into the view.
 */

import { useCallback, useEffect, useState } from "react";
import type { Course } from "../lib/types";
import {
  fetchCourses,
  fetchLatestLectureTitles,
  createCourse as createCourseService,
  updateCourse as updateCourseService,
  deleteCourse as deleteCourseService,
} from "../services/courseService";

export interface UseCoursesResult {
  courses: Course[];
  featured: Record<string, string>;
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  createCourse: (
    name: string,
    color?: string,
    semesterId?: string
  ) => Promise<void>;
  updateCourse: (
    id: string,
    name: string,
    color?: string,
    semesterId?: string
  ) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
}

/**
 * React hook that manages the courses data lifecycle.
 *
 * Courses are scoped to a semester: pass its PocketBase id,
 * and only that semester's courses are fetched and created.
 *
 * @param semesterId — PocketBase id of the current semester
 *                     ("" disables fetching entirely)
 * @returns {UseCoursesResult} current courses, loading/error
 *          flags, a refetch function, and CRUD mutators.
 */
export function useCourses(semesterId?: string): UseCoursesResult {
  const [courses, setCourses] = useState<Course[]>([]);
  const [featured, setFeatured] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!semesterId) return;
    setLoading(true);
    setError("");
    try {
      const records = await fetchCourses(semesterId);
      setCourses(records);

      if (records.length > 0) {
        const titles = await fetchLatestLectureTitles(records);
        setFeatured(titles);
      }
    } catch (e) {
      console.error("Ошибка загрузки курсов:", e);
      setError(
        "Не удалось загрузить курсы: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setLoading(false);
    }
  }, [semesterId]);

  /**
   * Create a new course and refresh the list.
   *
   * @param name       — display name for the course
   * @param color      — optional HEX color (random default if omitted)
   * @param semesterId — optional semester to assign the course to
   */
  const createCourse = useCallback(
    async (name: string, color?: string, semesterId?: string) => {
      try {
        await createCourseService(name, color, semesterId);
        await load();
      } catch (e) {
        console.error("Ошибка создания курса:", e);
        setError(
          "Не удалось создать курс: " +
            (e instanceof Error ? e.message : String(e))
        );
      }
    },
    [load]
  );

  /**
   * Update a course's name and/or color and refresh the list.
   *
   * @param id         — PocketBase record ID
   * @param name       — new display name
   * @param color      — optional new HEX color
   * @param semesterId — optional new semester id (moves the course)
   */
  const updateCourse = useCallback(
    async (id: string, name: string, color?: string, semesterId?: string) => {
      try {
        await updateCourseService(id, name, color, semesterId);
        await load();
      } catch (e) {
        console.error("Ошибка обновления курса:", e);
        setError(
          "Не удалось обновить курс: " +
            (e instanceof Error ? e.message : String(e))
        );
      }
    },
    [load]
  );

  /**
   * Delete a course and refresh the list.
   *
   * @param id — PocketBase record ID
   */
  const deleteCourse = useCallback(
    async (id: string) => {
      try {
        await deleteCourseService(id);
        await load();
      } catch (e) {
        console.error("Ошибка удаления курса:", e);
        setError(
          "Не удалось удалить курс: " +
            (e instanceof Error ? e.message : String(e))
        );
      }
    },
    [load]
  );

  useEffect(() => {
    if (!semesterId) {
      setCourses([]);
      setFeatured({});
      setLoading(false);
      return;
    }
    void load();
  }, [load, semesterId]);

  return {
    courses,
    featured,
    loading,
    error,
    refetch: load,
    createCourse,
    updateCourse,
    deleteCourse,
  };
}