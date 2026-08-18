/**
 * ============================================
 *  useRecentLectures.ts — Recent Lectures Hook
 * ============================================
 *
 * Fetches the most-recent lectures across all
 * courses.  Used by the Dashboard's "Recent
 * Files" section to show a combined timeline.
 */

import { useCallback, useEffect, useState } from "react";
import type { Lecture } from "../lib/types";
import { errorMessage } from "../lib/format";
import { fetchRecentLectures as fetchRecentLecturesService } from "../services/lectureService";

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
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const records = await fetchRecentLecturesService(limit);
      setLectures(records);
    } catch (e) {
      console.error("Ошибка загрузки лекций:", e);
      setError(
        "Не удалось загрузить лекции: " + errorMessage(e)
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { lectures, loading, error, refetch: load };
}