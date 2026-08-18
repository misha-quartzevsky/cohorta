/**
 * ============================================
 *  useLectureSearch.ts — Live Lecture Search Hook
 * ============================================
 *
 * Debounced full-text search used by the Header's search field.
 * Resolves each hit into a navigation path (`to`) by joining
 * lecture → course → semester. Courses/semesters are fetched
 * once (both collections are small), only lectures are queried
 * per keystroke.
 */

import { useEffect, useRef, useState } from "react";
import type { Course, Lecture, Semester } from "../lib/types";
import {
  courseName,
  courseSemesterId,
  courseSlug,
  lectureBody,
  lectureCourseId,
  lectureSlug,
  lectureTitle,
  semesterSlug,
  stripHtml,
} from "../lib/types";
import { searchLectures } from "../services/lectureService";
import { fetchCourses } from "../services/courseService";
import { fetchSemesters } from "../services/semesterService";
import { useSemester } from "../lib/semesterContext";

export interface SearchHit {
  id: string;
  title: string;
  /** Plain-text snippet of the lecture body (no HTML). */
  snippet: string;
  /** Course name (assigned lectures only). */
  courseName?: string;
  /** Resolved route, e.g. /s/5/filosofiya/intro. */
  to: string;
}

interface CourseIndex {
  courses: Map<string, Course>;
  semesters: Map<string, Semester>;
}

export interface UseLectureSearchResult {
  results: SearchHit[];
  loading: boolean;
}

/**
 * @param query  — raw input of the search field
 * @param active — false → no search (dropdown closed)
 */
export function useLectureSearch(
  query: string,
  active: boolean
): UseLectureSearchResult {
  const { current } = useSemester();
  const currentSlug = current ? semesterSlug(current) : "";

  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const indexRef = useRef<CourseIndex | null>(null);

  // Course + semester maps (one-time).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [courses, semesters] = await Promise.all([
          fetchCourses(),
          fetchSemesters(),
        ]);
        if (cancelled) return;
        indexRef.current = {
          courses: new Map(courses.map((c) => [c.id, c])),
          semesters: new Map(semesters.map((s) => [s.id, s])),
        };
      } catch (e) {
        console.error("Ошибка загрузки справочников для поиска:", e);
        if (!cancelled) indexRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (!active || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const records = await searchLectures(q);
        if (cancelled) return;
        const index = indexRef.current;
        const hits: SearchHit[] = records.map((lec: Lecture) =>
          buildHit(lec, index, currentSlug)
        );
        if (!cancelled) setResults(hits);
      } catch (e) {
        console.error("Ошибка поиска лекций:", e);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active, currentSlug]);

  return { results, loading };
}

/** Превращает запись лекции в результат с путём навигации. */
function buildHit(
  lec: Lecture,
  index: CourseIndex | null,
  fallbackSemesterSlug: string
): SearchHit {
  const courseId = lectureCourseId(lec);
  const course = courseId ? index?.courses.get(courseId) : undefined;

  let to: string;
  if (course) {
    const semId = courseSemesterId(course);
    const sem = semId ? index?.semesters.get(semId) : undefined;
    const semSlug = sem ? semesterSlug(sem) : fallbackSemesterSlug;
    to = `/s/${semSlug}/${courseSlug(course)}/${lectureSlug(lec)}`;
  } else {
    // Независимая заметка — открывается под текущим семестром.
    to = `/s/${fallbackSemesterSlug || "1"}/note/${lectureSlug(lec)}`;
  }

  return {
    id: lec.id,
    title: lectureTitle(lec),
    snippet: stripHtml(lectureBody(lec)).slice(0, 100),
    courseName: course ? courseName(course) : undefined,
    to,
  };
}