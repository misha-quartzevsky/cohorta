/**
 * ============================================
 *  useSemesters.ts — Semesters Data Hook
 * ============================================
 *
 * Fetches the full list of semesters.  Used by
 * the SemesterProvider (global semester state)
 * and the semester switcher UI.
 */

import { useCallback, useEffect, useState } from "react";
import type { Semester } from "../lib/types";
import { errorMessage } from "../lib/format";
import { fetchSemesters as fetchSemestersService } from "../services/semesterService";

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
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const records = await fetchSemestersService();
      setSemesters(records);
    } catch (e) {
      console.error("Ошибка загрузки семестров:", e);
      setError(
        "Не удалось загрузить семестры: " + errorMessage(e)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { semesters, loading, error, refetch: load };
}
