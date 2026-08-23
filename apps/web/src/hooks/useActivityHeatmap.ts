/**
 * ============================================
 *  useActivityHeatmap.ts — Activity Heatmap Hook
 * ============================================
 *
 * Collects the user's recent activity (lectures/decks updated timestamps)
 * and groups it into a day → action-count map. The map feeds the Dashboard's
 * compact `ActivityHeatmap` component.
 *
 * Deliberately lightweight: reuses existing hooks (useRecentLectures with a
 * big limit + useDecks(0) = all) and just sums by local calendar day.
 */

import { useMemo } from "react";
import { useRecentLectures } from "./useRecentLectures";
import { useDecks } from "./useDecks";

/** Local calendar-day key, e.g. "2026-08-21". */
export function heatmapDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface UseActivityHeatmapResult {
  /** day key ("YYYY-MM-DD") → number of actions that day. */
  days: Map<string, number>;
  /** Сколько заметок СОЗДАНО за последние 7 дней (для факта в приветствии). */
  notesThisWeek: number;
  loading: boolean;
}

/** Number of days rendered in the heatmap grid (≈3 months). */
export const HEATMAP_DAYS = 13 * 7;

/** Adds one "action" to the count of the local day the ISO string belongs to. */
function addDay(counts: Map<string, number>, iso?: string): void {
  if (!iso) return;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return;
  const key = heatmapDayKey(date);
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Учитывает запись как «создание» и, если правка была в другой день, ещё и
 * как «правку». Раньше created и updated считались всегда по отдельности —
 * у нетронутой записи один факт превращался в два действия, и карта
 * показывала вдвое больше активности, чем было.
 */
function addRecord(
  counts: Map<string, number>,
  created?: string,
  updated?: string
): void {
  addDay(counts, created);
  if (!created || !updated) {
    addDay(counts, updated);
    return;
  }
  const a = new Date(created);
  const b = new Date(updated);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return;
  if (heatmapDayKey(a) !== heatmapDayKey(b)) addDay(counts, updated);
}

export function useActivityHeatmap(): UseActivityHeatmapResult {
  // `useRecentLectures` slices by limit — a huge number returns all records.
  const { lectures, loading: lecturesLoading } = useRecentLectures(1e9);
  const { decks, loading: decksLoading } = useDecks(0);

  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lec of lectures) addRecord(counts, lec.created, lec.updated);
    for (const deck of decks) addRecord(counts, deck.created, deck.updated);
    return counts;
  }, [lectures, decks]);

  // Считаем по `created` и по ПОЛНОЙ выборке. Раньше дашборд брал
  // useRecentLectures(30) и фильтровал по `updated` — счётчик упирался в
  // лимит выборки и называл «новыми» просто отредактированные записи.
  const notesThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return lectures.filter((lec) => {
      const created = new Date(lec.created).getTime();
      return !Number.isNaN(created) && created >= weekAgo;
    }).length;
  }, [lectures]);

  return {
    days,
    notesThisWeek,
    loading: lecturesLoading || decksLoading,
  };
}
