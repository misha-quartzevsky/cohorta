/**
 * ============================================
 *  useProductSearch.ts — поиск по продукту (B2)
 * ============================================
 * Debounced, тот же паттерн, что useLectureSearch.ts (сайдбар, волна A4).
 * В режиме «Группа» ищет только в выбранной группе (`groupId`): лекции одногруппников по названию,
 * их предметы и сами одногруппники.
 */

import { useEffect, useState } from "react";
import { groupSearch, productSearch, type GroupSearchResult, type SearchResult } from "../services/searchService";

const EMPTY: SearchResult = { lectures: [], previews: [], courses: [], classmates: [] };
const GROUP_EMPTY: GroupSearchResult = { lectures: [], subjects: [], people: [] };

export function useProductSearch(query: string, active: boolean, groupId = "") {
  const [result, setResult] = useState<SearchResult>(EMPTY);
  const [groupResult, setGroupResult] = useState<GroupSearchResult>(GROUP_EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!active || q.length < 2) {
      setResult(EMPTY);
      setGroupResult(GROUP_EMPTY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (groupId) {
          const r = await groupSearch(groupId, q);
          if (!cancelled) setGroupResult(r);
        } else {
          const r = await productSearch(q);
          if (!cancelled) setResult(r);
        }
      } catch (e) {
        console.error("Ошибка поиска по продукту:", e);
        if (!cancelled) {
          setResult(EMPTY);
          setGroupResult(GROUP_EMPTY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active, groupId]);

  return { result, groupResult, loading };
}
