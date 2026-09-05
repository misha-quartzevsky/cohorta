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
 *
 * Design Sprint, Концепция A (доработка по фидбэку): помимо агрегатного
 * счётчика `days`, теперь также отдаёт сами лекции и число правок колод на
 * каждый день (`dayLectures`/`dayDeckCount`) — чтобы StudyWeekStrip мог
 * показать, какие именно курсы обновлялись, а не только факт активности.
 * Оба построены той же атрибуцией «день создания + день правки, если
 * отличается», что и `days` — через общий хелпер `attributedDayKeys`.
 */

import { useMemo } from "react";
import { useRecentLectures } from "./useRecentLectures";
import { useDecks } from "./useDecks";
import { parsePbDate } from "../lib/format";
import type { Lecture } from "../lib/types";

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
  /** day key → лекции, атрибутированные на этот день (созданы и/или правились). */
  dayLectures: Map<string, Lecture[]>;
  /** day key → число правок колод в этот день (колоды не привязаны к курсу,
   *  поэтому их нельзя сгруппировать так же, как лекции). */
  dayDeckCount: Map<string, number>;
  /** Сколько заметок СОЗДАНО за последние 7 дней (для факта в приветствии). */
  notesThisWeek: number;
  loading: boolean;
}

/** Number of days rendered in the heatmap grid (≈3 months). */
export const HEATMAP_DAYS = 13 * 7;

/**
 * На какие day-key атрибутируется запись: день создания и, если правка была
 * в другой день, ещё и день правки. Раньше created и updated считались
 * всегда по отдельности — у нетронутой записи один факт превращался в два
 * действия, и карта показывала вдвое больше активности, чем было.
 */
function attributedDayKeys(created?: string, updated?: string): string[] {
  const keys: string[] = [];
  const addKey = (iso?: string) => {
    const date = parsePbDate(iso);
    if (!date) return;
    keys.push(heatmapDayKey(date));
  };

  addKey(created);
  if (!created || !updated) {
    addKey(updated);
    return keys;
  }
  const a = parsePbDate(created);
  const b = parsePbDate(updated);
  if (!a || !b) return keys;
  if (heatmapDayKey(a) !== heatmapDayKey(b)) addKey(updated);
  return keys;
}

export function useActivityHeatmap(): UseActivityHeatmapResult {
  // `useRecentLectures` слайсит по лимиту — огромное число возвращает всё.
  const { lectures, loading: lecturesLoading } = useRecentLectures(1e9);
  const { decks, loading: decksLoading } = useDecks(0);

  const { days, dayLectures, dayDeckCount } = useMemo(() => {
    const days = new Map<string, number>();
    const dayLectures = new Map<string, Lecture[]>();
    const dayDeckCount = new Map<string, number>();

    for (const lec of lectures) {
      for (const key of attributedDayKeys(lec.created, lec.updated)) {
        days.set(key, (days.get(key) ?? 0) + 1);
        const arr = dayLectures.get(key);
        if (arr) arr.push(lec);
        else dayLectures.set(key, [lec]);
      }
    }
    for (const deck of decks) {
      for (const key of attributedDayKeys(deck.created, deck.updated)) {
        days.set(key, (days.get(key) ?? 0) + 1);
        dayDeckCount.set(key, (dayDeckCount.get(key) ?? 0) + 1);
      }
    }

    return { days, dayLectures, dayDeckCount };
  }, [lectures, decks]);

  // Считаем по `created` и по ПОЛНОЙ выборке. Раньше дашборд брал
  // useRecentLectures(30) и фильтровал по `updated` — счётчик упирался в
  // лимит выборки и называл «новыми» просто отредактированные записи.
  const notesThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return lectures.filter((lec) => {
      const created = parsePbDate(lec.created)?.getTime();
      return created !== undefined && created >= weekAgo;
    }).length;
  }, [lectures]);

  return {
    days,
    dayLectures,
    dayDeckCount,
    notesThisWeek,
    loading: lecturesLoading || decksLoading,
  };
}
