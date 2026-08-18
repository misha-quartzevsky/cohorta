/**
 * ============================================
 *  useAsyncData.ts — Generic async data hook
 * ============================================
 *
 * Owns the full loading / error / refetch lifecycle for any
 * data-fetching hook, removing the duplicated state and
 * effect boilerplate from useSemesters, useRecentLectures,
 * useLectures and useCourses.
 *
 * The caller supplies a `fetcher` (ideally memoized with the
 * same deps that should trigger a reload via `useCallback`)
 * and an optional `enabled` flag — when disabled the hook
 * clears its data and reports `loading: false` without
 * firing a request.
 */

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../lib/format";

export interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string;
  /** Programmatic error override — lets mutators surface their own messages. */
  setError: (message: string) => void;
  refetch: () => Promise<void>;
}

/**
 * Fetches `fetcher()` once on mount and whenever `fetcher` or
 * `enabled` changes, exposing the data plus loading/error state.
 *
 * @param fetcher — async function producing the data
 * @param enabled — when false, skip requests and stay idle
 * @returns {UseAsyncDataResult<T>} data, loading/error flags, setError, refetch
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  enabled: boolean = true
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await fetcher();
      setData(result);
    } catch (e) {
      console.error("useAsyncData: fetch failed", e);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [enabled, fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, setError, refetch: load };
}
