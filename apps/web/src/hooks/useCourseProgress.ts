/**
 * ============================================
 *  useCourseProgress.ts — реальная активность по курсам
 * ============================================
 *
 * Никакого «прогресса завершения» — в модели нет отметки «лекция
 * прочитана», поэтому мы не рисуем то, чего не измеряем (см. историю
 * с выдуманным 62%-баром в ResumeBlock). Честные факты, которые есть:
 *  - сколько лекций у курса всего;
 *  - сколько из них правились/создавались за последние ACTIVE_WINDOW_DAYS.
 *
 * Второе — тот же признак «активности», что уже лежит в основе
 * useActivityHeatmap, просто агрегированный по курсу, а не по дню.
 */

import { useRecentLectures } from "./useRecentLectures";
import { parsePbDate } from "../lib/format";
import { lectureCourseId } from "../lib/types";

/** Окно, в пределах которого правка лекции считается «недавней». */
export const ACTIVE_WINDOW_DAYS = 14;

export interface CourseProgress {
  /** Сколько лекций у курса всего. */
  count: number;
  /** Сколько из них создавались/правились за последние ACTIVE_WINDOW_DAYS. */
  recentCount: number;
}

const EMPTY: CourseProgress = { count: 0, recentCount: 0 };

/**
 * @param courseIds — id курсов, для которых нужна активность
 * @returns map «id курса → { count, recentCount }»; отсутствующий id
 *          (ещё не пришли courseIds) не бросает, просто не даёт записи
 */
export function useCourseProgress(
  courseIds: string[]
): Record<string, CourseProgress> {
  // Большой лимит = «все лекции»: тот же приём, что в useActivityHeatmap.
  const { lectures } = useRecentLectures(2000);

  // Без useMemo: courseIds — новый массив на каждом рендере (Dashboard
  // передаёт courses.map(...)), так что мемоизация по ссылке ничего бы не
  // сэкономила. Список лекций на дашборде — десятки записей, пересчёт дешёв.
  const wanted = new Set(courseIds);
  const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const map: Record<string, CourseProgress> = {};
  for (const lec of lectures) {
    const courseId = lectureCourseId(lec);
    if (!courseId || !wanted.has(courseId)) continue;
    const entry = map[courseId] ?? { ...EMPTY };
    entry.count += 1;
    const updated = parsePbDate(lec.updated)?.getTime();
    if (updated !== undefined && updated >= cutoff) entry.recentCount += 1;
    map[courseId] = entry;
  }
  return map;
}
