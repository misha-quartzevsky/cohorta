/**
 * ============================================
 *  useRecentLectures.ts — Recent Lectures Hook
 * ============================================
 *
 * Fetches the most-recent lectures across all
 * courses.  Used by the Dashboard's "Recent
 * Files" section to show a combined timeline.
 */

import { useCallback } from "react";
import type { Lecture } from "../lib/types";
import { fetchRecentLectures as fetchRecentLecturesService } from "../services/lectureService";
import { useAsyncData } from "./useAsyncData";

/** Result type returned by the hook. */
export interface UseRecentLecturesResult {
  lectures: Lecture[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

/**
 * React hook that fetches the N most-recent lectures.
 *
 * @param limit — max records to return (default 10)
 * @returns {UseRecentLecturesResult} lectures array, loading/error, refetch
 */
export function useRecentLectures(
  limit: number = 10
): UseRecentLecturesResult {
  const fetcher = useCallback(
    () => fetchRecentLecturesService(limit),
    [limit]
  );
  const { data, loading, error, refetch } = useAsyncData<Lecture[]>(fetcher);

  return { lectures: data ?? [], loading, error, refetch };
}
