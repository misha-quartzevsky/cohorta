/**
 * ============================================
 *  useProductSearch.ts — поиск по продукту (B2)
 * ============================================
 * Debounced, тот же паттерн, что useLectureSearch.ts (сайдбар, волна A4).
 */

import { useEffect, useState } from "react";
import { productSearch, type SearchResult } from "../services/searchService";

const EMPTY: SearchResult = { lectures: [], previews: [], courses: [], classmates: [] };

export function useProductSearch(query: string, active: boolean) {
  const [result, setResult] = useState<SearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!active || q.length < 2) {
      setResult(EMPTY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await productSearch(q);
        if (!cancelled) setResult(r);
      } catch (e) {
        console.error("Ошибка поиска по продукту:", e);
        if (!cancelled) setResult(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active]);

  return { result, loading };
}
