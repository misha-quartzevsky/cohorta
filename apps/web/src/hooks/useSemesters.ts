/**
 * ============================================
 *  useSemesters.ts — Semesters Data Hook
 * ============================================
 *
 * Fetches the full list of semesters.  Used by
 * the SemesterProvider (global semester state)
 * and the semester switcher UI.
 */

import { useCallback } from "react";
import type { Semester } from "../lib/types";
import { fetchSemesters as fetchSemestersService } from "../services/semesterService";
import { useAsyncData } from "./useAsyncData";

/** Result type returned by the hook. */
export interface UseSemestersResult {
  semesters: Semester[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

/**
 * React hook that fetches all semesters.
 *
 * @returns {UseSemestersResult} semesters array, loading/error, refetch
 */
export function useSemesters(): UseSemestersResult {
  const fetcher = useCallback(
    () => fetchSemestersService(),
    []
  );
  const { data, loading, error, refetch } = useAsyncData<Semester[]>(fetcher);

  return { semesters: data ?? [], loading, error, refetch };
}

