import type { Task } from "./types";
import { fromDateStr, todayStr, addDays, toDateStr } from "./localDate";

/** Открыта ли задача (done_at пусто). */
export function isOpen(t: Task): boolean {
  return !t.done_at;
}

/** Просрочена: открытая и due < today. */
export function isOverdue(t: Task, today: string = todayStr()): boolean {
  return isOpen(t) && !!t.due && t.due < today;
}

const WD_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTH_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

/** Подпись срока: «Сегодня», «Завтра», «Сб, 17 окт», «20 окт». */
export function dueLabel(due: string, today: string = todayStr()): string {
  if (due === today) return "Сегодня";
  if (due === toDateStr(addDays(fromDateStr(today), 1))) return "Завтра";
  const d = fromDateStr(due);
  const sameYear = d.getFullYear() === fromDateStr(today).getFullYear();
  const within7 = due > today && due <= toDateStr(addDays(fromDateStr(today), 7));
  const base = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  const withYear = sameYear ? base : `${base} ${d.getFullYear()}`;
  // В ближайшую неделю показываем день недели для ориентира.
  return within7 ? `${WD_SHORT[d.getDay()]}, ${withYear}` : withYear;
}
