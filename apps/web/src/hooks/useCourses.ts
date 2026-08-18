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

import { useCallback } from "react";
import type { Course } from "../lib/types";
import { errorMessage } from "../lib/format";
import {
  fetchCourses,
  fetchLatestLectureTitles,
  createCourse as createCourseService,
  updateCourse as updateCourseService,
  deleteCourse as deleteCourseService,
} from "../services/courseService";
import { useAsyncData } from "./useAsyncData";

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

/** Data produced by the fetcher: the course list + last-lecture titles. */
interface CourseBundle {
  courses: Course[];
  featured: Record<string, string>;
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
  const fetcher = useCallback(async (): Promise<CourseBundle> => {
    try {
      const records = await fetchCourses(semesterId);
      if (records.length === 0) {
        return { courses: records, featured: {} };
      }
      const featured = await fetchLatestLectureTitles(records);
      return { courses: records, featured };
    } catch (e) {
      console.error("Ошибка загрузки курсов:", e);
      throw new Error("Не удалось загрузить курсы: " + errorMessage(e));
    }
  }, [semesterId]);

  const { data, loading, error, setError, refetch } = useAsyncData<
    CourseBundle
  >(fetcher, !!semesterId);

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
        await refetch();
      } catch (e) {
        console.error("Ошибка создания курса:", e);
        setError(
          "Не удалось создать курс: " + errorMessage(e)
        );
      }
    },
    [refetch, setError]
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
        await refetch();
      } catch (e) {
        console.error("Ошибка обновления курса:", e);
        setError(
          "Не удалось обновить курс: " + errorMessage(e)
        );
      }
    },
    [refetch, setError]
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
        await refetch();
      } catch (e) {
        console.error("Ошибка удаления курса:", e);
        setError(
          "Не удалось удалить курс: " + errorMessage(e)
        );
      }
    },
    [refetch, setError]
  );

  return {
    courses: data?.courses ?? [],
    featured: data?.featured ?? {},
    loading,
    error,
    refetch,
    createCourse,
    updateCourse,
    deleteCourse,
  };
}