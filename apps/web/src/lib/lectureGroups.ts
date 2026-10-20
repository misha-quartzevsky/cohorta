/**
 * Группы списка лекций: «Эта неделя» и «Ранее» (Screen-lectures,
 * Screen-subject-lectures и их телефонные версии). «Эта неделя» — дата лекции
 * в текущей календарной неделе (понедельник — воскресенье), всё остальное,
 * включая лекции без даты, — «Ранее» (подтверждено владелицей 20.10).
 * При периоде «Все периоды» (Screen-period-lists) группы — по периодам.
 */

import { mondayOf, addDays } from "./localDate";

export interface LectureGroup<T> {
  key: string;
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

export interface PeriodRef {
  id: string;
  label: string;
  order: number;
}

/**
 * «Все периоды»: группы по периодам, новые сверху. Порядок внутри группы сохраняется.
 * Элементы без периода (лекция без предмета) идут последней группой «Без предмета».
 */
export function groupByPeriod<T>(items: T[], periodOf: (item: T) => PeriodRef | null): LectureGroup<T>[] {
  const byId = new Map<string, { ref: PeriodRef; items: T[] }>();
  const none: T[] = [];
  for (const item of items) {
    const ref = periodOf(item);
    if (!ref) {
      none.push(item);
      continue;
    }
    const entry = byId.get(ref.id) ?? { ref, items: [] };
    entry.items.push(item);
    byId.set(ref.id, entry);
  }
  const groups = [...byId.values()]
    .sort((a, b) => b.ref.order - a.ref.order)
    .map((e) => ({ key: `period:${e.ref.id}`, title: e.ref.label, items: e.items }));
  if (none.length) groups.push({ key: "none", title: "Без предмета", items: none });
  return groups;
}
