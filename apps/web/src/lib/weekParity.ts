import type { Lecture, ScheduleSlot, WeekParity } from "./types";
import { mondayOf, daysBetween, fromDateStr, toDateStr } from "./localDate";

/**
 * Чётность недели (spec раздел 3).
 * weekIndex = floor((monday(date) - odd_week_anchor) / 7).
 * weekIndex % 2 == 0 → нечётная, иначе чётная.
 * Отрицательные значения нормализуем через ((n % 2) + 2) % 2.
 * Функция чистая.
 */
export function getWeekParity(date: Date, anchor: Date): "odd" | "even" {
  const mDate = mondayOf(date);
  const mAnchor = mondayOf(anchor);
  const weekIndex = Math.floor(daysBetween(mAnchor, mDate) / 7);
  const norm = ((weekIndex % 2) + 2) % 2;
  return norm === 0 ? "odd" : "even";
}

/** Применим ли слот к неделе данной чётности. */
export function slotMatchesParity(
  slotParity: WeekParity | undefined,
  parity: "odd" | "even"
): boolean {
  const p = slotParity ?? "any";
  return p === "any" || p === parity;
}

/**
 * Найти лекцию для конкретной пары (слот + дата): spec 4.2.
 * lectures.slot = slot.id && lectures.lecture_date = date (YYYY-MM-DD).
 */
export function findLectureForOccurrence(
  slot: ScheduleSlot,
  dateStr: string,
  lectures: Lecture[]
): Lecture | null {
  return (
    lectures.find(
      (l) => l.slot === slot.id && l.lecture_date === dateStr
    ) ?? null
  );
}

/** Дата (YYYY-MM-DD) дня weekday (1..7) в неделе, содержащей `ref`. */
export function dateForWeekday(ref: Date, weekday: number): string {
  const monday = mondayOf(ref);
  const d = new Date(monday);
  d.setDate(monday.getDate() + (weekday - 1));
  return toDateStr(d);
}

/** Применим ли слот к конкретной дате с учётом чётности и границ действия. */
export function slotActiveOn(
  slot: ScheduleSlot,
  dateStr: string,
  anchor: Date
): boolean {
  const date = fromDateStr(dateStr);
  const parity = getWeekParity(date, anchor);
  if (!slotMatchesParity(slot.week_parity, parity)) return false;
  if (slot.date_from && dateStr < slot.date_from) return false;
  if (slot.date_to && dateStr > slot.date_to) return false;
  return true;
}
