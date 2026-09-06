/**
 * ============================================
 *  SemesterContext.tsx — Semester Provider
 * ============================================
 *
 * Provides the current semester (derived from the
 * URL `/s/:semesterSlug/…`) and the full semester
 * list to the whole app.  Switching semesters
 * rewrites the URL while preserving the rest of
 * the path (e.g. /s5/filosofia → /s6/filosofia).
 *
 * The context object and the `useSemester` hook
 * live in `semesterContext.ts` (non-component
 * exports are kept out of this file for Fast
 * Refresh compatibility).
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { pb } from "./pocketbase";
import { useSemesters } from "../hooks/useSemesters";
import {
  SemesterContext,
  LAST_SEMESTER_KEY,
  type SemesterContextValue,
} from "./semesterContext";
import { semesterSlug } from "./types";

/**
 * Wraps the app (inside BrowserRouter) and provides
 * semester state based on the current URL.
 */
export function SemesterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { semesters, loading, error, refetch } = useSemesters();

  // Периоды теперь per-user: список, загруженный на /login до авторизации,
  // пуст. Перечитываем только когда МЕНЯЕТСЯ пользователь (вход / выход /
  // онбординг) — не на каждый `authRefresh`, иначе лишний ре-рендер всего
  // дерева отцепляет элементы страницы посреди действия.
  const lastUserId = useRef<string>(pb.authStore.record?.id ?? "");
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      const id = pb.authStore.record?.id ?? "";
      if (id === lastUserId.current) return;
      lastUserId.current = id;
      void refetch();
    });
    return unsubscribe;
  }, [refetch]);

  // Extract the semester slug from "/s/:slug/…" paths.
  const semesterSlugFromUrl = useMemo(() => {
    const m = location.pathname.match(/^\/s\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }, [location.pathname]);

  const current = useMemo(
    () => semesters.find((s) => semesterSlug(s) === semesterSlugFromUrl) ?? null,
    [semesters, semesterSlugFromUrl]
  );

  // Remember the last visited semester.
  useEffect(() => {
    if (semesterSlugFromUrl) {
      localStorage.setItem(LAST_SEMESTER_KEY, semesterSlugFromUrl);
    }
  }, [semesterSlugFromUrl]);

  /**
   * Switch the semester: replace the /s/:slug segment in the
   * current URL, keeping the rest of the path intact.
   */
  const setSemester = useCallback(
    (slug: string) => {
      const rest = location.pathname.replace(/^\/s\/[^/]+/, "");
      navigate(`/s/${slug}${rest || ""}`);
      localStorage.setItem(LAST_SEMESTER_KEY, slug);
    },
    [location.pathname, navigate]
  );

  const value = useMemo<SemesterContextValue>(
    () => ({
      semesters,
      loading,
      error,
      current,
      semesterSlug: semesterSlugFromUrl,
      setSemester,
      refetch,
    }),
    [semesters, loading, error, current, semesterSlugFromUrl, setSemester, refetch]
  );

  return (
    <SemesterContext.Provider value={value}>
      {children}
    </SemesterContext.Provider>
  );
}
