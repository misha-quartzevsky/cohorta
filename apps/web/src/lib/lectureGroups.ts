/**
 * Группы списка лекций: «Эта неделя» и «Ранее» (Screen-lectures,
 * Screen-subject-lectures и их телефонные версии).
 *
 * Правило группировки в макетах не описано (в десктопных макетах одна и та же
 * лекция от 4 октября лежит и в «Эта неделя», и в «Ранее»), поэтому взято
 * простое: «Эта неделя» — дата лекции в текущей календарной неделе
 * (понедельник — воскресенье), всё остальное, включая лекции без даты, —
 * «Ранее». Правило ждёт подтверждения владелицы (PROGRESS.md).
 */

import { mondayOf, addDays } from "./localDate";

export interface LectureGroup<T> {
  key: "week" | "earlier";
  title: string;
  items: T[];
}

/** Дата лекции как локальная календарная дата без времени. */
function lectureDay(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Делит уже отсортированный список на «Эта неделя» и «Ранее»; пустые группы не возвращает. */
export function groupByWeek<T>(
  items: T[],
  dateOf: (item: T) => string | undefined,
  now: Date = new Date()
): LectureGroup<T>[] {
  const monday = mondayOf(now);
  const weekStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const weekEnd = addDays(weekStart, 7);
  const week: T[] = [];
  const earlier: T[] = [];
  for (const item of items) {
    const day = lectureDay(dateOf(item));
    if (day && day >= weekStart && day < weekEnd) week.push(item);
    else earlier.push(item);
  }
  const groups: LectureGroup<T>[] = [];
  if (week.length) groups.push({ key: "week", title: "Эта неделя", items: week });
  if (earlier.length) groups.push({ key: "earlier", title: "Ранее", items: earlier });
  return groups;
}
